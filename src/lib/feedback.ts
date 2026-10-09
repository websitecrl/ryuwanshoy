// Rules shared by the feedback form, the crash report button and
// POST /api/feedback, so the browser and the server can't disagree.
// The database enforces the same limits again (20261009120000_create_feedback.sql).

/** Kinds a reader can pick in the form. 'crash' is only sent by the error screen. */
export const FEEDBACK_FORM_KINDS = ['bug', 'idea', 'other'] as const
export const FEEDBACK_KINDS = [...FEEDBACK_FORM_KINDS, 'crash'] as const

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug',
  idea: 'Idea',
  other: 'Other',
  crash: 'Crash report',
}

export const FEEDBACK_LIMITS = {
  message: 1000,
  email: 254,
  pageUrl: 500,
  userAgent: 500,
  errorMessage: 1000,
  errorDigest: 100,
} as const

// something@something.tld, and none of the characters that would let the
// address change a `mailto:` link (extra recipients with , or ;, headers
// with ? or &, escapes with %), or break out of HTML.
const EMAIL_PART = `[^\\s@,;?&%<>"'()\\\\]+`
const EMAIL_RE = new RegExp(`^${EMAIL_PART}@${EMAIL_PART}\\.${EMAIL_PART}$`)

// A path on THIS site: "/" then not another "/" or "\" (which browsers treat
// as another site), and no whitespace, control characters or backslashes
// anywhere (browsers silently drop tabs/newlines, so "/<tab>/evil.com" would
// otherwise become //evil.com).
const SAFE_PATH = /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(value)
}

export function isValidEmail(value: string): boolean {
  return value.length <= FEEDBACK_LIMITS.email && EMAIL_RE.test(value)
}

/**
 * True only for a same-site path like "/comics/x/1?page=2".
 * Two layers: the strict pattern above, then a real URL parse that must stay
 * on the same origin. Used by the form, the API and the admin page.
 */
export function isSafeSitePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > FEEDBACK_LIMITS.pageUrl || !SAFE_PATH.test(value)) {
    return false
  }
  try {
    return new URL(value, 'https://site.invalid').origin === 'https://site.invalid'
  } catch {
    return false
  }
}

/** What the browser sends to POST /api/feedback (the user agent is read
 *  from the request header on the server, never from the body). */
export type FeedbackPayload = {
  kind: FeedbackKind
  message: string
  email?: string
  pageUrl?: string
  errorMessage?: string
  errorDigest?: string
}
