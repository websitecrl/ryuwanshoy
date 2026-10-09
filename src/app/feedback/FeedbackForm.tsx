'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import {
  FEEDBACK_FORM_KINDS,
  FEEDBACK_LABELS,
  FEEDBACK_LIMITS,
  isSafeSitePath,
  toFeedbackDevice,
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
 * Anyone can craft that link, so only strict same-site paths are kept
 * (isSafeSitePath; the API checks again).
 */
function sourcePage(): string | undefined {
  const from = new URLSearchParams(window.location.search).get('from')
  return isSafeSitePath(from) ? from : undefined
}

export default function FeedbackForm() {
  const [kind, setKind] = useState<FormKind>('bug')
  const [message, setMessage] = useState('')
  // Where the reader noticed it; at least one is required, both is allowed
  // (e.g. they saw it on their phone, then again on a computer).
  const [onWeb, setOnWeb] = useState(false)
  const [onPhone, setOnPhone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const device = toFeedbackDevice(onWeb, onPhone)
  const canSubmit = message.trim() !== '' && device !== null && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || device === null) return
    setSubmitting(true)
    const payload: FeedbackPayload = {
      kind,
      message: message.trim(),
      device,
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
      setSent(true) // the thank-you panel below is the confirmation

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
        <p className="text-sm text-[var(--ryu-text-2)]">Your feedback was sent.</p>
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
      {/* Type: native radios (one tab stop, arrow keys, announced as a group
          by the fieldset legend), styled as pills via `peer`. */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Type
        </legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_FORM_KINDS.map(k => (
            <label key={k} className="cursor-pointer">
              <input
                type="radio"
                name="feedback-kind"
                value={k}
                checked={k === kind}
                onChange={() => setKind(k)}
                className="peer sr-only"
              />
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm transition-colors border
                           border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]
                           peer-checked:border-[var(--ryu-primary)] peer-checked:bg-[var(--ryu-primary-soft)]
                           peer-checked:text-[var(--ryu-primary-deep)] peer-checked:font-semibold
                           peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ryu-primary)]"
              >
                {FEEDBACK_LABELS[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Device: native checkboxes styled as pills; at least one required,
          both allowed. Stored as 'web' | 'phone' | 'both'. */}
      <fieldset className="space-y-2" aria-describedby="feedback-device-note">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Where did it happen?
        </legend>
        <div className="flex flex-wrap gap-2">
          {([
            ['web', 'Web (computer)', onWeb, setOnWeb],
            ['phone', 'Phone', onPhone, setOnPhone],
          ] as const).map(([value, label, checked, set]) => (
            <label key={value} className="cursor-pointer">
              <input
                type="checkbox"
                name="feedback-device"
                value={value}
                checked={checked}
                onChange={e => set(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm transition-colors border
                           border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]
                           peer-checked:border-[var(--ryu-primary)] peer-checked:bg-[var(--ryu-primary-soft)]
                           peer-checked:text-[var(--ryu-primary-deep)] peer-checked:font-semibold
                           peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ryu-primary)]"
              >
                {label}
              </span>
            </label>
          ))}
        </div>
        <p id="feedback-device-note" className="text-xs text-[var(--ryu-text-3)]">
          Pick one, or both if you noticed it on both.
        </p>
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
