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

// Same shape check as the Early Access form: something@something.tld.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(value)
}

export function isValidEmail(value: string): boolean {
  return value.length <= FEEDBACK_LIMITS.email && EMAIL_RE.test(value)
}

/** What the browser sends to POST /api/feedback. */
export type FeedbackPayload = {
  kind: FeedbackKind
  message: string
  email?: string
  pageUrl?: string
  userAgent?: string
  errorMessage?: string
  errorDigest?: string
}
