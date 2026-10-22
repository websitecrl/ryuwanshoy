// Shared by the form, crash report and POST /api/feedback; the database enforces the same limits.

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

/** Where the reader noticed it (Web/Phone checkboxes, both = 'both'). Not asked on crash reports. */
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

// Same-site path only: no "//" or "/\", no whitespace or control chars ("/<tab>/evil.com" becomes //evil.com).
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

/** True only for a same-site path like "/comics/x/1?page=2" (pattern plus a same-origin URL parse). */
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

/** Body of POST /api/feedback. The user agent comes from the request header, never the body. */
export type FeedbackPayload = {
  kind: FeedbackKind
  message: string
  /** Required unless kind is 'crash'. */
  device?: FeedbackDevice
  pageUrl?: string
  errorMessage?: string
  errorDigest?: string
}
