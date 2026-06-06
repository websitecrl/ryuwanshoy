'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Heart, Send, MessageCircle } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import { v4 as uuidv4 } from 'uuid'

type Post = {
  id: string
  title: string | null
  description: string | null
  image_url: string
  post_type: string | null
  created_at: string | null
}

type Comment = {
  id: string
  name: string
  content: string
  created_at: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function getLikeToken(): string {
  const key = 'ryu.like_token'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const token = uuidv4()
    localStorage.setItem(key, token)
    return token
  } catch { return uuidv4() }
}

function getSavedName(): string {
  try { return localStorage.getItem('ryu.commenter.name') ?? '' } catch { return '' }
}

function saveName(name: string) {
  try { localStorage.setItem('ryu.commenter.name', name) } catch {}
}

interface Props {
  post: Post
  onClose: () => void
}

export default function PostModal({ post, onClose }: Props) {
  const [likeCount,   setLikeCount]   = useState(0)
  const [liked,       setLiked]       = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [comments,    setComments]    = useState<Comment[]>([])
  const [name,        setName]        = useState('')
  const [content,     setContent]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Load likes + comments on open
  useEffect(() => {
    const likeToken = getLikeToken()

    fetch(`/api/likes?post_id=${post.id}&like_token=${likeToken}`)
      .then(r => r.json())
      .then(({ count, liked }: { count: number; liked: boolean }) => {
        setLikeCount(count)
        setLiked(liked)
      })
      .catch(() => {})

    fetch(`/api/comments?post_id=${post.id}`)
      .then(r => r.json())
      .then((data: Comment[]) => setComments(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [post.id])

  // Restore saved name
  useEffect(() => {
    const saved = getSavedName()
    if (saved) setName(saved)
  }, [])

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleLike() {
    if (likeLoading) return
    setLikeLoading(true)
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, like_token: getLikeToken() }),
      })
      const { liked: newLiked, count } = await res.json() as { liked: boolean; count: number }
      setLiked(newLiked)
      setLikeCount(count)
    } catch {}
    setLikeLoading(false)
  }

  async function handleSubmit() {
    const trimName    = name.trim()
    const trimContent = content.trim()
    if (!trimName || !trimContent || submitting) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          name:    trimName,
          content: trimContent,
        }),
      })

      const data = await res.json() as Comment & { error?: string }

      if (res.status === 429) {
        setSubmitError('One comment per minute — try again shortly.')
        return
      }
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to post. Try again.')
        return
      }

      // Persist name for next time
      saveName(trimName)

      setComments(prev => [...prev, data])
      setContent('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setSubmitError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="relative flex overflow-hidden"
        style={{
          background: 'var(--ryu-surface-1)',
          borderRadius: 12,
          width: 'min(960px, 96vw)',
          maxHeight: '92vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none' }}
        >
          <X size={16} />
        </button>

        {/* Left: image */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            background: '#0d0d18',
            width: 'clamp(280px, 55%, 560px)',
            maxHeight: '92vh',
          }}
        >
          <Image
            src={post.image_url}
            alt={post.title ?? 'Post'}
            width={560}
            height={700}
            className="w-full h-auto block"
            style={{ maxHeight: '92vh', objectFit: 'contain' }}
          />
        </div>

        {/* Right: info + comments + input */}
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ borderLeft: '0.5px solid var(--ryu-border)', minWidth: 280 }}
        >
          {/* Post info header */}
          <div
            className="px-4 py-3 shrink-0"
            style={{ borderBottom: '0.5px solid var(--ryu-border)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ fontFamily: "'Bangers', cursive", background: 'var(--ryu-primary)', letterSpacing: '0.04em' }}
              >
                R
              </div>
              <div>
                <p className="text-sm font-semibold leading-none" style={{ color: 'var(--ryu-text)', fontFamily: "'Quicksand', sans-serif" }}>
                  Ryu
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--ryu-text-muted)' }}>
                  {formatDate(post.created_at)}
                </p>
              </div>
            </div>
            {post.title && (
              <p className="text-sm font-semibold mt-2" style={{ color: 'var(--ryu-text)', fontFamily: "'Quicksand', sans-serif" }}>
                {post.title}
              </p>
            )}
            {post.description && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ryu-text-secondary)' }}>
                {post.description}
              </p>
            )}
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {comments.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--ryu-text-muted)' }}>
                No comments yet — be the first!
              </p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 uppercase"
                    style={{ background: 'var(--ryu-primary)', color: '#fff' }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--ryu-text)', fontFamily: "'Quicksand', sans-serif" }}>
                        {c.name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--ryu-text-muted)' }}>
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--ryu-text-secondary)' }}>
                      {c.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Like bar + name + comment input */}
          <div
            className="shrink-0 px-4 py-3 flex flex-col gap-2"
            style={{ borderTop: '0.5px solid var(--ryu-border)' }}
          >
            {/* Like button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className="flex items-center gap-1.5 text-sm transition-all duration-150"
                style={{
                  background: 'none', border: 'none',
                  color: liked ? '#f43f5e' : 'var(--ryu-text-muted)',
                  fontFamily: "'Quicksand', sans-serif", fontWeight: 600,
                  cursor: likeLoading ? 'not-allowed' : 'pointer',
                }}
              >
                <Heart size={18} fill={liked ? '#f43f5e' : 'none'} stroke={liked ? '#f43f5e' : 'currentColor'} strokeWidth={2} />
              </button>
              {likeCount > 0 && (
                <span className="text-xs font-semibold" style={{ color: 'var(--ryu-text)' }}>
                  {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
                </span>
              )}
              <div className="flex items-center gap-1 ml-1" style={{ color: 'var(--ryu-text-muted)' }}>
                <MessageCircle size={16} strokeWidth={2} />
                <span className="text-xs font-semibold" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                  {comments.length}
                </span>
              </div>
            </div>

            {/* Name input */}
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="w-full h-8 px-3 rounded-lg text-xs outline-none"
              style={{
                border: '0.5px solid var(--ryu-border)',
                background: 'var(--ryu-surface-2)',
                color: 'var(--ryu-text)',
                fontFamily: "'Quicksand', sans-serif",
              }}
            />

            {/* Comment input + send */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment…"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                maxLength={300}
                className="flex-1 h-9 px-3 rounded-lg text-xs outline-none"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-2)',
                  color: 'var(--ryu-text)',
                  fontFamily: "'Quicksand', sans-serif",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !name.trim() || !content.trim()}
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
                style={{
                  background: 'var(--ryu-primary)', color: '#fff', border: 'none',
                  opacity: (submitting || !name.trim() || !content.trim()) ? 0.4 : 1,
                  cursor: (submitting || !name.trim() || !content.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                <Send size={14} />
              </button>
            </div>

            {submitError && (
              <p className="text-[10px]" style={{ color: '#dc2626' }}>{submitError}</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .post-modal-inner {
            flex-direction: column !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
          }
          .post-modal-image {
            width: 100% !important;
            max-height: 45vh !important;
          }
          .post-modal-side {
            border-left: none !important;
            border-top: 0.5px solid var(--ryu-border) !important;
          }
        }
      `}</style>
    </div>
  )
}