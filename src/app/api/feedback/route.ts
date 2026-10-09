import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { rateLimit } from '@/lib/rate-limit-cf'
import { isProfane } from '@/lib/profanity'
import { FEEDBACK_LIMITS, isFeedbackKind, isValidEmail } from '@/lib/feedback'

// Admin list size: newest first. Feedback is low volume; older rows can be
// deleted from the admin page.
const ADMIN_LIST_LIMIT = 100

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
// Public. Body: { kind, message, email?, pageUrl?, errorMessage?, errorDigest? }
// - kind: 'bug' | 'idea' | 'other' from the form, 'crash' from the error screen
// - message: required (1..1000) except for 'crash', where it's an optional note
// - email: optional, only for a reply
// - pageUrl: a path on this site (e.g. /comics/x/1), never a full URL
// User agent is read from the request header, not trusted from the body.
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

  const { kind, message, email, pageUrl, errorMessage, errorDigest } = body ?? {}

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

  let replyTo: string | null = null
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !isValidEmail(email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Please enter a valid email, or leave it empty.' }, { status: 400 })
    }
    replyTo = email.trim().toLowerCase()
  }

  // Only a path on this site: keeps full external URLs (and anything with a
  // scheme) out of the admin page.
  const page = cleanText(pageUrl, FEEDBACK_LIMITS.pageUrl)
  const safePage = page && page.startsWith('/') && !page.startsWith('//') ? page : null

  const isCrash = kind === 'crash'
  const { error } = await supabaseAdmin.from('feedback').insert({
    kind,
    message: text,
    email: replyTo,
    page_url: safePage,
    user_agent: cleanText(req.headers.get('user-agent'), FEEDBACK_LIMITS.userAgent),
    error_message: isCrash ? cleanText(errorMessage, FEEDBACK_LIMITS.errorMessage) : null,
    error_digest: isCrash ? cleanText(errorDigest, FEEDBACK_LIMITS.errorDigest) : null,
  })

  if (error) {
    console.error('POST /api/feedback error:', error)
    return NextResponse.json({ error: 'Could not send. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

// ─── GET /api/feedback ────────────────────────────────────────────────────────
// Admin only. { feedback: Row[] (newest first, max 100), unread: number }
// `unread` counts ALL unread rows, not just the ones returned.
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const [listRes, unreadRes] = await Promise.all([
    supabaseAdmin
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(ADMIN_LIST_LIMIT),
    supabaseAdmin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ])

  const error = listRes.error ?? unreadRes.error
  if (error) {
    console.error('GET /api/feedback error:', error)
    return NextResponse.json({ error: 'Failed to load feedback.' }, { status: 500 })
  }
  return NextResponse.json({ feedback: listRes.data, unread: unreadRes.count ?? 0 })
}

// ─── PATCH /api/feedback ──────────────────────────────────────────────────────
// Admin only. Marks every unread report as read ("Mark all read").
export async function PATCH() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { error } = await supabaseAdmin
    .from('feedback')
    .update({ is_read: true })
    .eq('is_read', false)

  if (error) {
    console.error('PATCH /api/feedback error:', error)
    return NextResponse.json({ error: 'Failed to update feedback.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
