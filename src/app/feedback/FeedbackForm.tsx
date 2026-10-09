'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import {
  FEEDBACK_FORM_KINDS,
  FEEDBACK_LABELS,
  FEEDBACK_LIMITS,
  isValidEmail,
  type FeedbackPayload,
} from '@/lib/feedback'
import { toastRateLimited } from '@/lib/rate-limit-toast'

type FormKind = (typeof FEEDBACK_FORM_KINDS)[number]

const PLACEHOLDERS: Record<FormKind, string> = {
  bug: 'What went wrong? Which page, and what did you tap?',
  idea: 'What would make the site better?',
  other: 'Anything you want to tell us.',
}

/**
 * The page the reader came from, passed by the footer link as ?from=/path.
 * Only same-site paths are kept (the API checks this again).
 */
function sourcePage(): string | undefined {
  const from = new URLSearchParams(window.location.search).get('from')
  return from && from.startsWith('/') && !from.startsWith('//') ? from : undefined
}

export default function FeedbackForm() {
  const [kind, setKind] = useState<FormKind>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const trimmedEmail = email.trim()
  const emailInvalid = trimmedEmail !== '' && !isValidEmail(trimmedEmail.toLowerCase())
  const canSubmit = message.trim() !== '' && !emailInvalid && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const payload: FeedbackPayload = {
      kind,
      message: message.trim(),
      email: trimmedEmail || undefined,
      pageUrl: sourcePage(),
    }
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 429) { toastRateLimited(); return }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not send. Please try again.')
      toast.success('Thanks! Your feedback was sent.')
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[var(--ryu-border)] bg-[var(--ryu-surface-1)] p-6 text-center space-y-3">
        <p className="text-base font-semibold text-[var(--ryu-text)]">Thank you!</p>
        <p className="text-sm text-[var(--ryu-text-2)]">
          Your feedback was sent{trimmedEmail ? ', and we may reply to the email you gave' : ''}.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setMessage('') }}
          className="text-sm font-semibold text-[var(--ryu-primary)] hover:opacity-80"
        >
          Send more feedback
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--ryu-border)] bg-[var(--ryu-surface-1)] p-5 space-y-5"
    >
      {/* Type */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Type
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {FEEDBACK_FORM_KINDS.map(k => {
            const active = k === kind
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors border ${
                  active
                    ? 'border-[var(--ryu-primary)] bg-[var(--ryu-primary-soft)] text-[var(--ryu-primary-deep)] font-semibold'
                    : 'border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]'
                }`}
              >
                {FEEDBACK_LABELS[k]}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Message */}
      <div className="space-y-1">
        <label htmlFor="feedback-message" className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={PLACEHOLDERS[kind]}
          rows={6}
          maxLength={FEEDBACK_LIMITS.message}
          required
          className="w-full text-sm rounded-lg border px-3 py-2 resize-y outline-none transition-colors
                     bg-[var(--ryu-surface-2)] border-[var(--ryu-border)] text-[var(--ryu-text)]
                     placeholder:text-[var(--ryu-text-3)] focus:border-[var(--ryu-primary)]"
        />
        <p className="text-right text-xs text-[var(--ryu-text-3)]">
          {message.length} / {FEEDBACK_LIMITS.message}
        </p>
      </div>

      {/* Email (optional) */}
      <div className="space-y-1">
        <label htmlFor="feedback-email" className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Email <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          id="feedback-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          maxLength={FEEDBACK_LIMITS.email}
          aria-invalid={emailInvalid}
          aria-describedby="feedback-email-note"
          placeholder="you@example.com"
          className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors
                     bg-[var(--ryu-surface-2)] border-[var(--ryu-border)] text-[var(--ryu-text)]
                     placeholder:text-[var(--ryu-text-3)] focus:border-[var(--ryu-primary)]"
        />
        <p id="feedback-email-note" className="text-xs text-[var(--ryu-text-3)]">
          {emailInvalid
            ? 'That email doesn’t look right. Fix it or leave it empty.'
            : 'Only if you want a reply. It’s only seen by the admin and never shared.'}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold
                     bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]
                     hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          <Send size={14} />
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </form>
  )
}
