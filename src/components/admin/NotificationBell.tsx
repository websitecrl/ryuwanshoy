'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Trash2, CheckCheck, Heart } from 'lucide-react'

type NotifType = 'comment' | 'like'

type Notification = {
  id: string
  type: NotifType
  name?: string
  content?: string
  is_read: boolean | null
  created_at: string | null
  post_id?: string | null
  chapter_id?: string | null
  post_title?: string | null
  chapter_number?: number | null
  series_title?: string | null
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z'
  const diff  = Date.now() - new Date(normalized).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const SEEN_LIKES_KEY = 'ryu.seen_likes'

function notifLabel(n: Notification): string {
  const target =
    n.post_title ? `"${n.post_title}"` :
    n.series_title && n.chapter_number
      ? `"${n.series_title} Ch. ${n.chapter_number}"`
      : 'a post'
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
  const dropdownRef           = useRef<HTMLDivElement>(null)
  const supabase              = createClient()
  const [, setTicking] = useState(0)

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json() as { notifications: Notification[] }
      const raw = json.notifications ?? []

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

  async function deleteNotif(n: Notification) {
    if (n.type === 'comment') {
      await fetch(`/api/comments/${n.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/likes/${n.id}`, { method: 'DELETE' })
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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifs])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
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

  const hasUnread = unread > 0

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
          {hasUnread ? `${unread > 9 ? '9+' : unread} new` : 'Notifications'}
        </span>

        {hasUnread && (
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-white"
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: 'var(--ryu-primary)',
            }}
          >
            {unread > 9 ? '9+' : unread}
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
            boxShadow:  '0 8px 32px -8px rgba(0,0,0,0.18)',
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

          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: 'var(--ryu-text-muted)' }}
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
                      background: n.type === 'like' ? '#FCE7F3' : 'var(--ryu-primary)',
                      color:      n.type === 'like' ? '#9D174D' : '#fff',
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
                        style={{ color: 'var(--ryu-text-secondary)', fontFamily: "'Quicksand', system-ui, sans-serif" }}
                      >
                        "{n.content}"
                      </p>
                    )}
                    <span
                      className="text-[10px] mt-1 block"
                      style={{ color: 'var(--ryu-text-muted)', fontFamily: "'Quicksand', system-ui, sans-serif" }}
                    >
                      {timeAgo(n.created_at ?? '')}
                    </span>
                  </div>

                  <button
                    onClick={() => deleteNotif(n)}
                    className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--ryu-text-muted)', background: 'none', border: 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ryu-text-muted)'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}