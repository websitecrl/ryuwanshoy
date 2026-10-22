import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { rateLimit } from '@/lib/rate-limit-cf'
import { countUnreadFeedback } from '@/lib/feedback-server'
import { isProfane } from '@/lib/profanity'
import { isUuid } from '@/lib/validation'
import { FEEDBACK_LIMITS, isFeedbackDevice, isFeedbackKind, isSafeSitePath } from '@/lib/feedback'

export const dynamic = 'force-dynamic'

// Admin inbox page size, newest first; "Load older" pages through the rest.
const ADMIN_PAGE_SIZE = 50
const MAX_MARK_IDS = 500

// Next.js error digests are short numeric/word ids; anything else is dropped.
const DIGEST_RE = /^[\w-]{1,100}$/


/** Trimmed and capped text, or null when empty. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

// Public. Body: { kind, message, device?, pageUrl?, errorMessage?, errorDigest? }
// message and device are optional only for 'crash'. No email or IP is stored (IP only feeds the rate limiter).
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'FEEDBACK_LIMITER')
  if (limited) return limited

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { kind, message, device, pageUrl, errorMessage, errorDigest } = body ?? {}

  if (!isFeedbackKind(kind)) {
    return NextResponse.json({ error: 'Please choose a feedback type.' }, { status: 400 })
  }

  if (message !== undefined && typeof message !== 'string') {
    return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })
  }
  const text = (message ?? '').trim()
  if (kind !== 'crash' && !text) {
    return NextResponse.json({ error: 'Please write a message.' }, { status: 400 })
  }
  if (text.length > FEEDBACK_LIMITS.message) {
    return NextResponse.json(
      { error: `Message is too long (max ${FEEDBACK_LIMITS.message} characters).` },
      { status: 400 }
    )
  }
  if (text && isProfane(text)) {
    return NextResponse.json(
      { error: 'Your message contains prohibited language.' },
      { status: 400 }
    )
  }

  const isCrash = kind === 'crash'
  if (!isCrash && !isFeedbackDevice(device)) {
    return NextResponse.json(
      { error: 'Please choose where it happened: Web, Phone, or both.' },
      { status: 400 }
    )
  }

  // Same-site paths only, so the inbox can't be fed a phishing link.
  const safePage = isSafeSitePath(pageUrl) ? pageUrl : null

  const digest = cleanText(errorDigest, FEEDBACK_LIMITS.errorDigest)
  const { error } = await supabaseAdmin.from('feedback').insert({
    kind,
    message: text,
    device: !isCrash && isFeedbackDevice(device) ? device : null,
    page_url: safePage,
    user_agent: cleanText(req.headers.get('user-agent'), FEEDBACK_LIMITS.userAgent),
    error_message: isCrash ? cleanText(errorMessage, FEEDBACK_LIMITS.errorMessage) : null,
    error_digest: isCrash && digest && DIGEST_RE.test(digest) ? digest : null,
  })

  if (error) {
    console.error('POST /api/feedback error:', error)
    return NextResponse.json({ error: 'Could not send. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

// Admin. One page, newest first [?before=<cursor>] → { feedback, unread, total, nextCursor }; counts cover all rows.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const before = req.nextUrl.searchParams.get('before')
  if (before !== null && (before.length > 40 || Number.isNaN(Date.parse(before)))) {
    return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
  }

  let pageQuery = supabaseAdmin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ADMIN_PAGE_SIZE + 1)
  if (before) pageQuery = pageQuery.lt('created_at', before)

  try {
    const [pageRes, totalRes, unread] = await Promise.all([
      pageQuery,
      supabaseAdmin.from('feedback').select('id', { count: 'exact', head: true }),
      countUnreadFeedback(),
    ])
    if (pageRes.error) throw pageRes.error
    if (totalRes.error) throw totalRes.error

    const hasMore = pageRes.data.length > ADMIN_PAGE_SIZE
    const rows = hasMore ? pageRes.data.slice(0, ADMIN_PAGE_SIZE) : pageRes.data
    const oldest = rows[rows.length - 1]
    return NextResponse.json({
      feedback: rows,
      unread,
      total: totalRes.count ?? 0,
      nextCursor: hasMore && oldest ? oldest.created_at : null,
    })
  } catch (error) {
    console.error('GET /api/feedback error:', error)
    return NextResponse.json({ error: 'Failed to load feedback.' }, { status: 500 })
  }
}

// Admin. Marks exactly the given ids read (only what the inbox loaded) → { ok, unread }.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const ids = body?.ids
  if (
    !Array.isArray(ids) || ids.length === 0 || ids.length > MAX_MARK_IDS ||
    !ids.every(id => isUuid(id))
  ) {
    return NextResponse.json({ error: `ids must be 1 to ${MAX_MARK_IDS} uuids.` }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('feedback')
    .update({ is_read: true })
    .in('id', ids)
  if (error) {
    console.error('PATCH /api/feedback error:', error)
    return NextResponse.json({ error: 'Failed to update feedback.' }, { status: 500 })
  }

  // A failed recount shouldn't turn a successful update into an error.
  let unread: number | null = null
  try {
    unread = await countUnreadFeedback()
  } catch (err) {
    console.error('feedback unread count error:', err)
  }
  return NextResponse.json({ ok: true, unread })
}
