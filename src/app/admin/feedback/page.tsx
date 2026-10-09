'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCheck, Mail, Trash2, Circle, CircleCheck } from 'lucide-react'
import type { Tables } from '@/types/database'
import { FEEDBACK_LABELS, isFeedbackKind, isSafeSitePath, isValidEmail } from '@/lib/feedback'
import { timeAgo } from '@/lib/time'

type Feedback = Tables<'feedback'>
type Filter = 'all' | 'unread'
type Page = { feedback: Feedback[]; unread: number; total: number; nextCursor: string | null }

/**
 * Admin inbox for reader feedback and crash reports (spec 0001).
 * Data: GET /api/feedback, 50 per page, "Load older" for more. Actions go
 * through PATCH/DELETE /api/feedback/[id] and PATCH /api/feedback (mark the
 * LOADED reports read); every one is admin-checked on the server and returns
 * the server's unread count, which the header shows as is (no local math).
 *
 * Reader-supplied values are shown as text (React escapes them); the page
 * path only becomes a link after isSafeSitePath, and the reply link only for
 * a valid email, even though the API already filtered both.
 */
export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [unread, setUnread] = useState(0)
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function fetchPage(before?: string): Promise<Page> {
    const res = await fetch(`/api/feedback${before ? `?before=${encodeURIComponent(before)}` : ''}`)
    if (!res.ok) throw new Error()
    return (await res.json()) as Page
  }

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const page = await fetchPage()
      setItems(page.feedback)
      setUnread(page.unread)
      setTotal(page.total)
      setNextCursor(page.nextCursor)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await fetchPage(nextCursor)
      setItems(prev => {
        const seen = new Set(prev.map(f => f.id))
        return [...prev, ...page.feedback.filter(f => !seen.has(f.id))]
      })
      setUnread(page.unread)
      setTotal(page.total)
      setNextCursor(page.nextCursor)
    } catch {
      toast.error('Could not load older feedback.')
    } finally {
      setLoadingOlder(false)
    }
  }

  /** Applies the server's unread count when the API returned one. */
  function syncUnread(json: { unread?: number | null }) {
    if (typeof json.unread === 'number') setUnread(json.unread)
  }

  async function setRead(item: Feedback, isRead: boolean) {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: isRead }),
      })
      if (!res.ok) throw new Error()
      setItems(prev => prev.map(f => (f.id === item.id ? { ...f, is_read: isRead } : f)))
      syncUnread(await res.json())
    } catch {
      toast.error('Could not update. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  // Marks only the reports loaded on this page, never ones the admin hasn't
  // seen (older pages or reports that arrived after loading).
  const loadedUnreadIds = items.filter(f => !f.is_read).map(f => f.id)
  async function markAllRead() {
    if (loadedUnreadIds.length === 0) return
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: loadedUnreadIds }),
      })
      if (!res.ok) throw new Error()
      const marked = new Set(loadedUnreadIds)
      setItems(prev => prev.map(f => (marked.has(f.id) ? { ...f, is_read: true } : f)))
      syncUnread(await res.json())
      toast.success('Marked as read')
    } catch {
      toast.error('Could not update. Please try again.')
    }
  }

  async function remove(item: Feedback) {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/feedback/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(f => f.id !== item.id))
      setTotal(n => Math.max(0, n - 1))
      syncUnread(await res.json())
      toast.success('Deleted')
    } catch {
      toast.error('Could not delete. Please try again.')
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  const shown = filter === 'unread' ? items.filter(f => !f.is_read) : items

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ryu-text)]">Feedback</h1>
          <p className="text-sm text-[var(--ryu-text-2)]">
            Bug reports, ideas and crash reports from readers. {unread > 0 ? `${unread} unread.` : 'All read.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                filter === f
                  ? 'border-[var(--ryu-primary)] text-[var(--ryu-primary-deep)] bg-[var(--ryu-primary-soft)] font-semibold'
                  : 'border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]'
              }`}
            >
              {f === 'all' ? 'All' : `Unread (${unread})`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={loadedUnreadIds.length === 0}
            title="Marks the reports loaded below as read"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border
                       border-[var(--ryu-border)] text-[var(--ryu-text)] bg-[var(--ryu-surface-1)]
                       disabled:opacity-40 hover:bg-[var(--ryu-surface-2)] transition-colors"
          >
            <CheckCheck size={14} /> Mark shown as read
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-[var(--ryu-text-3)]">Loading…</p>
      ) : failed ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--ryu-text-2)]">Couldn&apos;t load feedback.</p>
          <button type="button" onClick={() => void load()} className="text-sm font-semibold text-[var(--ryu-primary)]">
            Retry
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--ryu-text-3)] py-10 text-center">
          {filter === 'unread' ? 'Nothing unread.' : 'No feedback yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map(item => {
            const kind = isFeedbackKind(item.kind) ? FEEDBACK_LABELS[item.kind] : item.kind
            const busy = busyId === item.id
            return (
              <li
                key={item.id}
                className={`rounded-xl border p-4 space-y-3 bg-[var(--ryu-surface-1)] ${
                  item.is_read ? 'border-[var(--ryu-border)]' : 'border-[var(--ryu-primary)]'
                }`}
              >
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ryu-text-3)]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      item.kind === 'crash'
                        ? 'bg-[var(--ryu-primary-soft)] text-[var(--ryu-primary-deep)]'
                        : 'bg-[var(--ryu-surface-3)] text-[var(--ryu-text-2)]'
                    }`}
                  >
                    {kind}
                  </span>
                  {!item.is_read && <span className="font-semibold text-[var(--ryu-primary-deep)]">New</span>}
                  <span title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</span>
                  {item.page_url && (
                    isSafeSitePath(item.page_url) ? (
                      <a
                        href={item.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[var(--ryu-text)] truncate max-w-xs"
                      >
                        {item.page_url}
                      </a>
                    ) : (
                      // Never a link: shown as text so an odd value can't send the admin anywhere.
                      <span className="truncate max-w-xs">{item.page_url}</span>
                    )
                  )}
                </div>

                {/* Message */}
                {item.message ? (
                  <p className="text-sm text-[var(--ryu-text)] whitespace-pre-wrap break-words">{item.message}</p>
                ) : (
                  <p className="text-sm italic text-[var(--ryu-text-3)]">No note from the reader.</p>
                )}

                {/* Crash details */}
                {item.kind === 'crash' && (item.error_message || item.error_digest) && (
                  <details className="text-xs text-[var(--ryu-text-2)]">
                    <summary className="cursor-pointer select-none">Error details</summary>
                    <div className="mt-2 rounded-lg bg-[var(--ryu-surface-2)] p-3 space-y-1 font-mono break-all">
                      {item.error_message && <p>{item.error_message}</p>}
                      {item.error_digest && (
                        <p className="text-[var(--ryu-text-3)]">
                          digest: {item.error_digest} (search this in the Cloudflare Workers logs)
                        </p>
                      )}
                    </div>
                  </details>
                )}

                {item.user_agent && (
                  // Reported by the reader's browser: a hint, not proof.
                  <p className="text-xs text-[var(--ryu-text-3)] break-words">
                    Browser (as reported): {item.user_agent}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {item.email && isValidEmail(item.email) && (
                    <a
                      href={`mailto:${item.email}`}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border
                                 border-[var(--ryu-border)] text-[var(--ryu-text)] hover:bg-[var(--ryu-surface-2)]"
                    >
                      <Mail size={14} /> Reply to {item.email}
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setRead(item, !item.is_read)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border
                               border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]
                               disabled:opacity-40"
                  >
                    {item.is_read ? <Circle size={14} /> : <CircleCheck size={14} />}
                    {item.is_read ? 'Mark unread' : 'Mark read'}
                  </button>

                  {/* Inline confirm instead of window.confirm (no blocking dialogs). */}
                  {confirmingId === item.id ? (
                    <span className="flex items-center gap-2 text-xs text-[var(--ryu-text-2)]">
                      Delete?
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item)}
                        className="rounded-lg px-3 py-1.5 font-semibold bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)] disabled:opacity-40"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg px-3 py-1.5 font-semibold border border-[var(--ryu-border)]"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(item.id)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                                 text-[var(--ryu-text-3)] hover:text-[var(--ryu-primary-deep)]"
                      aria-label="Delete this feedback"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Paging: everything older than what's loaded */}
      {!loading && !failed && items.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs text-[var(--ryu-text-3)]">
            Showing {items.length} of {total} report{total === 1 ? '' : 's'}.
          </p>
          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-[var(--ryu-border)]
                         text-[var(--ryu-text)] bg-[var(--ryu-surface-1)] hover:bg-[var(--ryu-surface-2)]
                         disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
