'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCheck, Heart, MessageSquare } from 'lucide-react'
import DeleteButton from '@/components/admin/DeleteButton'
import { timeAgo } from '@/lib/time'

type NotifType = 'comment' | 'like'

type Notification = {
  id: string
  type: NotifType
  name?: string
  content?: string
  is_read: boolean | null
  created_at: string | null
  post_id?: string | null
  post_title?: string | null
  series_title?: string | null
}

const SEEN_LIKES_KEY = 'ryu.seen_likes'

// Comments live on a series or on a post (illustration); likes only on posts.
function notifLabel(n: Notification): string {
  const target =
    n.post_title ? `"${n.post_title}"` :
    n.series_title ? `"${n.series_title}"` :
    n.type === 'like' ? 'a post' : 'a series'
  if (n.type === 'like') return `Someone liked ${target}`
  return `${n.name ?? 'Someone'} commented on ${target}`
}

function getSeenLikes(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_LIKES_KEY)
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch { return new Set() }
}

function markLikeSeen(id: string) {
  try {
    const seen = getSeenLikes()
    seen.add(id)
    // FIX: save the trimmed array, not the un-trimmed set
    const trimmed = [...seen].slice(-200)
    localStorage.setItem(SEEN_LIKES_KEY, JSON.stringify(trimmed))
  } catch {}
}

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [unread,  setUnread]  = useState(0)
  // Unread reader feedback. Not cleared by opening the bell (unlike comments):
  // it's handled on /admin/feedback, so a report is never "read" by accident.
  const [feedbackUnread, setFeedbackUnread] = useState(0)
  const dropdownRef           = useRef<HTMLDivElement>(null)
  const supabase              = createClient()
  const [, setTicking] = useState(0)

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json() as { notifications: Notification[]; feedbackUnread?: number }
      const raw = json.notifications ?? []
      setFeedbackUnread(json.feedbackUnread ?? 0)

      // FIX: cross-reference localStorage so seen likes aren't counted as unread
      const seenLikes = getSeenLikes()
      const all = raw.map(n =>
        n.type === 'like' && seenLikes.has(n.id)
          ? { ...n, is_read: true as const }
          : n
      )

      setNotifs(all)
      setUnread(all.filter(n => n.is_read !== true).length)
    } catch {
      // silent fail
    }
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'POST' })
    // Mark all current likes as seen in localStorage
    notifs.forEach(n => {
      if (n.type === 'like') markLikeSeen(n.id)
    })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  // Deletes the real comment or like (not just the notification). Throws on
  // failure so DeleteButton shows the error; before, a failed delete still
  // disappeared from the list.
  async function deleteNotif(n: Notification) {
    const url = n.type === 'comment' ? `/api/comments/${n.id}` : `/api/likes/${n.id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(json.error ?? `Failed to delete ${n.type}`)
    }
    setNotifs(prev => prev.filter(x => x.id !== n.id))
    if (n.is_read !== true) setUnread(prev => Math.max(0, prev - 1))
  }

  useEffect(() => {
    const interval = setInterval(() => setTicking(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchNotifs()

    const channel = supabase
      .channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchNotifs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' },    fetchNotifs)
      // New reports (and reads/deletes from /admin/feedback) refresh the count.
      // Needs the admin SELECT policy from 20261009120000_create_feedback.sql.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, fetchNotifs)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifs])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // The delete confirm dialog renders in a portal outside the dropdown;
      // clicks in it must not close the dropdown (that would unmount the
      // dialog mid-delete).
      if ((e.target as Element | null)?.closest?.('[data-slot^="alert-dialog"]')) return
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    setOpen(o => !o)
    if (!open && unread > 0) markAllRead()
  }

  const totalUnread = unread + feedbackUnread
  const hasUnread = totalUnread > 0
  const badge = totalUnread > 9 ? '9+' : String(totalUnread)

  return (
    <div className="relative" ref={dropdownRef}>

      <button
        onClick={handleOpen}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150"
        style={{
          background: hasUnread
            ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)'
            : open ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-1)',
          border: `1.5px solid ${hasUnread || open ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`,
          color: hasUnread || open ? 'var(--ryu-primary)' : 'var(--ryu-text-2)',
          boxShadow: hasUnread ? '0 0 0 3px color-mix(in srgb, var(--ryu-primary) 15%, transparent)' : 'none',
        }}
      >
        <div style={{ animation: hasUnread ? 'bell-shake 1.2s ease infinite' : 'none' }}>
          <Bell size={16} />
        </div>

        <span className="text-xs font-semibold" style={{ fontFamily: "'Quicksand', sans-serif" }}>
          {hasUnread ? `${badge} new` : 'Notifications'}
        </span>

        {hasUnread && (
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: 'var(--ryu-primary)',
              color: 'var(--ryu-on-primary)',
            }}
          >
            {badge}
          </span>
        )}
      </button>

      <style>{`
        @keyframes bell-shake {
          0%, 100% { transform: rotate(0deg); }
          15%       { transform: rotate(14deg); }
          30%       { transform: rotate(-10deg); }
          45%       { transform: rotate(6deg); }
          60%       { transform: rotate(-4deg); }
          75%       { transform: rotate(2deg); }
        }
      `}</style>

      {open && (
        <div
          className="absolute right-0 top-12 w-80 rounded-xl overflow-hidden z-50"
          style={{
            background: 'var(--ryu-surface-1)',
            border:     '1px solid var(--ryu-border)',
            boxShadow:  '0 8px 32px -8px color-mix(in srgb, var(--ryu-ink) 18%, transparent)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--ryu-border)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                color: 'var(--ryu-text)',
                fontFamily: "'Bangers', cursive",
                letterSpacing: '0.04em',
                fontSize: 16,
              }}
            >
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                style={{ color: 'var(--ryu-primary)', background: 'none', border: 'none' }}
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {feedbackUnread > 0 && (
            <Link
              href="/admin/feedback"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                background:   'var(--ryu-primary-soft)',
                color:        'var(--ryu-primary-deep)',
                borderBottom: '1px solid var(--ryu-border)',
              }}
            >
              <MessageSquare size={14} />
              {feedbackUnread} new feedback {feedbackUnread === 1 ? 'report' : 'reports'}
              <span className="ml-auto">Open inbox →</span>
            </Link>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: 'var(--ryu-text-3)' }}
              >
                No notifications yet
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={`${n.type}-${n.id}`}
                  className="flex items-start gap-3 px-4 py-3 group transition-colors duration-100"
                  style={{
                    background:   n.is_read !== true
                      ? 'color-mix(in srgb, var(--ryu-primary) 6%, transparent)'
                      : 'transparent',
                    borderBottom: '0.5px solid var(--ryu-border)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                    style={{
                      background: n.type === 'like' ? 'var(--ryu-primary-soft)' : 'var(--ryu-primary)',
                      color:      n.type === 'like' ? 'var(--ryu-primary-deep)' : 'var(--ryu-on-primary)',
                    }}
                  >
                    {n.type === 'like'
                      ? <Heart size={12} />
                      : (n.name?.[0]?.toUpperCase() ?? 'A')
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs leading-relaxed"
                      style={{
                        color: 'var(--ryu-text)',
                        fontFamily: "'Quicksand', system-ui, sans-serif",
                        fontWeight: 600,
                      }}
                    >
                      {notifLabel(n)}
                    </p>
                    {n.type === 'comment' && n.content && (
                      <p
                        className="text-xs mt-0.5 leading-relaxed line-clamp-2"
                        style={{ color: 'var(--ryu-text-2)', fontFamily: "'Quicksand', system-ui, sans-serif" }}
                      >
                        "{n.content}"
                      </p>
                    )}
                    <span
                      className="text-[10px] mt-1 block"
                      style={{ color: 'var(--ryu-text-3)', fontFamily: "'Quicksand', system-ui, sans-serif" }}
                    >
                      {timeAgo(n.created_at ?? '')}
                    </span>
                  </div>

                  {/* Shown on hover, or when reached by keyboard. */}
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <DeleteButton
                      size={24}
                      label={n.type === 'comment' ? 'Delete comment' : 'Delete like'}
                      title={n.type === 'comment' ? 'Delete this comment?' : 'Delete this like?'}
                      description={
                        n.type === 'comment'
                          ? 'This permanently deletes the reader’s comment (and its replies) from the site. This cannot be undone.'
                          : 'This permanently removes the like from the post. This cannot be undone.'
                      }
                      successMessage={n.type === 'comment' ? 'Comment deleted' : 'Like removed'}
                      onConfirm={() => deleteNotif(n)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}