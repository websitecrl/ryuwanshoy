// shared by form, crash report and POST /api/feedback (DB enforces the same limits)

/** form kinds; 'crash' only from the error screen */
export const FEEDBACK_FORM_KINDS = ['bug', 'idea', 'other'] as const
export const FEEDBACK_KINDS = [...FEEDBACK_FORM_KINDS, 'crash'] as const

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug',
  idea: 'Idea',
  other: 'Other',
  crash: 'Crash report',
}

/** Web/Phone checkboxes -> 'web' | 'phone' | 'both'; not asked on crashes */
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

// "/" + not "/" or "\"; no whitespace/control chars ("/<tab>/evil.com" -> //evil.com)
const SAFE_PATH = /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(value)
}

export function isFeedbackDevice(value: unknown): value is FeedbackDevice {
  return typeof value === 'string' && (FEEDBACK_DEVICES as readonly string[]).includes(value)
}

/** checkboxes -> stored value (null if none) */
export function toFeedbackDevice(web: boolean, phone: boolean): FeedbackDevice | null {
  if (web && phone) return 'both'
  if (web) return 'web'
  if (phone) return 'phone'
  return null
}

/** pattern -> same-origin URL parse -> true */
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

/** POST /api/feedback body (user agent from the header) */
export type FeedbackPayload = {
  kind: FeedbackKind
  message: string
  /** required unless 'crash' */
  device?: FeedbackDevice
  pageUrl?: string
  errorMessage?: string
  errorDigest?: string
}
