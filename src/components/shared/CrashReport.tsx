'use client'

import { useState } from 'react'
import { FEEDBACK_LIMITS, type FeedbackPayload } from '@/lib/feedback'

type Status =
  | { state: 'idle' }
  | { state: 'writing' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'failed'; message: string }

/**
 * "Send report" box for the error screens (error.tsx, global-error.tsx).
 *
 * Nothing is sent until the reader taps Send. The report holds: the page
 * path, the error message, Next's error digest (also printed in the
 * Cloudflare Workers logs, so a report can be matched to its server log
 * line), the reader's optional note; the server adds the user agent.
 *
 * Status is shown inline rather than as a toast: global-error replaces the
 * root layout, which is where <Toaster /> lives.
 *
 * @param error - the error passed to the error boundary
 */
export default function CrashReport({ error }: { error: Error & { digest?: string } }) {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [note, setNote] = useState('')

  async function send() {
    setStatus({ state: 'sending' })
    const payload: FeedbackPayload = {
      kind: 'crash',
      message: note.trim(),
      pageUrl: window.location.pathname + window.location.search,
      errorMessage: error.message,
      errorDigest: error.digest,
    }
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 429) {
        setStatus({ state: 'failed', message: 'Too many reports. Please wait a minute and try again.' })
        return
      }
      if (!res.ok) {
        const { error: reason } = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus({ state: 'failed', message: reason ?? 'Could not send the report.' })
        return
      }
      setStatus({ state: 'sent' })
    } catch {
      setStatus({ state: 'failed', message: 'Could not send the report. Are you offline?' })
    }
  }

  if (status.state === 'sent') {
    return (
      <p role="status" style={{ fontSize: 14, color: 'var(--ryu-text-2)' }}>
        Report sent. Thank you for helping fix this!
      </p>
    )
  }

  if (status.state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStatus({ state: 'writing' })}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          fontSize: 14,
          textDecoration: 'underline',
          color: 'var(--ryu-text-2)',
          cursor: 'pointer',
        }}
      >
        Send a crash report
      </button>
    )
  }

  const sending = status.state === 'sending'
  return (
    <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor="crash-note" style={{ fontSize: 13, color: 'var(--ryu-text-2)', textAlign: 'left' }}>
        What were you doing? (optional)
      </label>
      <textarea
        id="crash-note"
        value={note}
        onChange={e => setNote(e.target.value)}
        maxLength={FEEDBACK_LIMITS.message}
        rows={3}
        disabled={sending}
        placeholder="e.g. I tapped Next chapter on my phone"
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--ryu-border)',
          background: 'var(--ryu-surface-2)',
          color: 'var(--ryu-text)',
          fontSize: 14,
          resize: 'none',
        }}
      />
      <p style={{ fontSize: 12, color: 'var(--ryu-text-3)', textAlign: 'left' }}>
        Sends this page&apos;s address, the error and your browser type. No personal data.
      </p>
      {status.state === 'failed' && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--ryu-primary-deep)', textAlign: 'left' }}>
          {status.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending}
        style={{
          alignSelf: 'flex-end',
          padding: '8px 18px',
          borderRadius: 8,
          border: '1px solid var(--ryu-border)',
          background: 'var(--ryu-surface-1)',
          color: 'var(--ryu-text)',
          fontSize: 14,
          fontWeight: 600,
          cursor: sending ? 'default' : 'pointer',
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Sending…' : 'Send report'}
      </button>
    </div>
  )
}
