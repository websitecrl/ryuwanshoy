// Rules shared by the feedback form, the crash report button and
// POST /api/feedback, so the browser and the server can't disagree.
// The database enforces the same limits again
// (20261009120000_create_feedback.sql, 20261009140000_feedback_device_drop_email.sql).

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

/**
 * Where the reader noticed it. The form has two checkboxes (Web, Phone) and
 * at least one is required; ticking both is stored as 'both'. Required for
 * every form kind; crash reports don't ask (the user agent shows it).
 */
export const FEEDBACK_DEVICES = ['web', 'phone', 'both'] as const
export type FeedbackDevice = (typeof FEEDBACK_DEVICES)[number]

export const DEVICE_LABELS: Record<FeedbackDevice, string> = {
  web: 'Web (computer)',
  phone: 'Phone',
  both: 'Web and phone',
}

export const FEEDBACK_LIMITS = {
  message: 1000,
  pageUrl: 500,
  userAgent: 500,
  errorMessage: 1000,
  errorDigest: 100,
} as const

// A path on THIS site: "/" then not another "/" or "\" (which browsers treat
// as another site), and no whitespace, control characters or backslashes
// anywhere (browsers silently drop tabs/newlines, so "/<tab>/evil.com" would
// otherwise become //evil.com).
const SAFE_PATH = /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(value)
}

export function isFeedbackDevice(value: unknown): value is FeedbackDevice {
  return typeof value === 'string' && (FEEDBACK_DEVICES as readonly string[]).includes(value)
}

/** The two form checkboxes → the stored value (null when neither is ticked). */
export function toFeedbackDevice(web: boolean, phone: boolean): FeedbackDevice | null {
  if (web && phone) return 'both'
  if (web) return 'web'
  if (phone) return 'phone'
  return null
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
  /** Required unless kind is 'crash'. */
  device?: FeedbackDevice
  pageUrl?: string
  errorMessage?: string
  errorDigest?: string
}
