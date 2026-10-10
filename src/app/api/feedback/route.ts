import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { rateLimit } from '@/lib/rate-limit-cf'
import { countUnreadFeedback } from '@/lib/feedback-server'
import { isProfane } from '@/lib/profanity'
import { isUuid } from '@/lib/validation'
import { FEEDBACK_LIMITS, isFeedbackDevice, isFeedbackKind, isSafeSitePath } from '@/lib/feedback'

// Admin reads cookies (requireAdmin) and must never be cached.
export const dynamic = 'force-dynamic'

// Admin inbox page size, newest first; "Load older" pages through the rest.
const ADMIN_PAGE_SIZE = 50
// Most ids "Mark all read" can send at once (what's loaded in the inbox).
const MAX_MARK_IDS = 500

// Next.js error digests are short numeric/word ids; anything else is dropped.
const DIGEST_RE = /^[\w-]{1,100}$/


/**
 * Trims a free-text value and caps its length.
 * @returns the trimmed string, or null when it's missing or empty
 */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

// ─── POST /api/feedback ───────────────────────────────────────────────────────
// Public. Body: { kind, message, device?, pageUrl?, errorMessage?, errorDigest? }
// - kind: 'bug' | 'idea' | 'other' from the form, 'crash' from the error screen
// - message: required (1..1000) except for 'crash', where it's an optional note
// - device: 'web' | 'phone' | 'both', required except for 'crash' (the reader
//   isn't asked there; the user agent shows it). No email is collected: any
//   `email` field sent by an old copy of the form is ignored.
// - pageUrl: a path on this site (e.g. /comics/x/1), never a full URL;
//   anything else is stored as null (see isSafeSitePath)
// User agent is read from the request header (not from the body). It's only
// a hint: any client can set that header.
// Nothing about the visitor's IP is stored; the IP is only used by the rate
// limiter (3 per minute).
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

  // Only a strict same-site path, never a full or disguised external URL
  // (e.g. "/<tab>/evil.com"), so the admin inbox can't be fed a phishing link.
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

// ─── GET /api/feedback ────────────────────────────────────────────────────────
// Admin only. One page, newest first:  [?before=<created_at of the oldest shown>]
// → { feedback: Row[], unread: number, total: number, nextCursor: string | null }
// `unread` and `total` cover ALL rows, not just this page, so the inbox can
// say how much is not loaded yet.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  // created_at is timestamptz, so the cursor is any valid timestamp string.
  const before = req.nextUrl.searchParams.get('before')
  if (before !== null && (before.length > 40 || Number.isNaN(Date.parse(before)))) {
    return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
  }

  let pageQuery = supabaseAdmin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ADMIN_PAGE_SIZE + 1) // one extra row tells us if more exist
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

// ─── PATCH /api/feedback ──────────────────────────────────────────────────────
// Admin only. Body: { ids: string[] } → marks exactly those reports read
// ("Mark all read" sends the ids loaded in the inbox, so reports the admin
// hasn't seen yet are never marked read by accident). → { ok, unread }
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

  // The update worked; a failed recount shouldn't turn that into an error.
  let unread: number | null = null
  try {
    unread = await countUnreadFeedback()
  } catch (err) {
    console.error('feedback unread count error:', err)
  }
  return NextResponse.json({ ok: true, unread })
}
