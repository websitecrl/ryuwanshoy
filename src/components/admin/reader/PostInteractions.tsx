'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Send, X } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import { v4 as uuidv4 } from 'uuid'

type Comment = {
  id: string
  name: string
  content: string
  created_at: string | null
  updated_at: string | null
}

// Stable like token per browser — stored in localStorage
function getLikeToken(): string {
  const key = 'ryu.like_token'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const token = uuidv4()
    localStorage.setItem(key, token)
    return token
  } catch {
    return uuidv4()
  }
}

interface Props {
  postId: string
}

export default function PostInteractions({ postId }: Props) {
  const [likeCount,    setLikeCount]    = useState(0)
  const [liked,        setLiked]        = useState(false)
  const [likeLoading,  setLikeLoading]  = useState(false)

  const [commentCount, setCommentCount] = useState(0)
  const [comments,     setComments]     = useState<Comment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)

  const [name,         setName]         = useState('')
  const [content,      setContent]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')

  // Load like count + liked state on mount
  useEffect(() => {
    const likeToken = getLikeToken()
    fetch(`/api/likes?post_id=${postId}&like_token=${likeToken}`)
      .then(r => r.json())
      .then(({ count, liked }: { count: number; liked: boolean }) => {
        setLikeCount(count)
        setLiked(liked)
      })
      .catch(() => {})
  }, [postId])

  // Load comment count on mount (lightweight — just count)
  useEffect(() => {
    fetch(`/api/comments?post_id=${postId}`)
      .then(r => r.json())
      .then((data: Comment[]) => setCommentCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [postId])

  // Load full comments when thread opens
  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?post_id=${postId}`)
    if (!res.ok) return
    const data = await res.json() as Comment[]
    setComments(Array.isArray(data) ? data : [])
    setCommentCount(Array.isArray(data) ? data.length : 0)
    setCommentsLoaded(true)
  }, [postId])

  function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded) loadComments()
  }

  async function handleLike() {
    if (likeLoading) return
    setLikeLoading(true)
    const likeToken = getLikeToken()
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, like_token: likeToken }),
      })
      const { liked: newLiked, count } = await res.json() as { liked: boolean; count: number }
      setLiked(newLiked)
      setLikeCount(count)
    } catch {}
    setLikeLoading(false)
  }

  async function handleSubmit() {
    if (!name.trim() || !content.trim() || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, name: name.trim(), content: content.trim() }),
      })
      if (res.status === 429) {
        setSubmitError('You can only post one comment per minute.')
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        setSubmitError('Failed to post comment. Try again.')
        setSubmitting(false)
        return
      }
      const newComment = await res.json() as Comment
      setComments(prev => [...prev, newComment])
      setCommentCount(prev => prev + 1)
      setContent('')
      // keep name filled for follow-up comments
    } catch {
      setSubmitError('Something went wrong.')
    }
    setSubmitting(false)
  }

  return (
    <div style={{ borderTop: '0.5px solid var(--ryu-border)' }}>

      {/* ── Action bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2">

        {/* Like */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={{
            background: liked
              ? 'color-mix(in srgb, #f43f5e 12%, transparent)'
              : 'transparent',
            color: liked ? '#f43f5e' : 'var(--ryu-text-muted)',
            border: '0.5px solid transparent',
            fontFamily: "'Quicksand', system-ui, sans-serif",
          }}
          onMouseEnter={e => {
            if (!liked) (e.currentTarget as HTMLElement).style.color = '#f43f5e'
          }}
          onMouseLeave={e => {
            if (!liked) (e.currentTarget as HTMLElement).style.color = 'var(--ryu-text-muted)'
          }}
        >
          <Heart
            size={14}
            fill={liked ? '#f43f5e' : 'none'}
            stroke={liked ? '#f43f5e' : 'currentColor'}
            strokeWidth={2}
          />
          <span>{likeCount > 0 ? likeCount : 'Like'}</span>
        </button>

        {/* Comment toggle */}
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={{
            background: showComments
              ? 'color-mix(in srgb, var(--ryu-primary) 10%, transparent)'
              : 'transparent',
            color: showComments ? 'var(--ryu-primary)' : 'var(--ryu-text-muted)',
            border: '0.5px solid transparent',
            fontFamily: "'Quicksand', system-ui, sans-serif",
          }}
        >
          <MessageCircle size={14} strokeWidth={2} />
          <span>{commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Comment'}</span>
        </button>
      </div>

      {/* ── Comment thread ───────────────────────────────────────── */}
      {showComments && (
        <div
          className="px-3 pb-3 flex flex-col gap-3"
          style={{ borderTop: '0.5px solid var(--ryu-border)' }}
        >

          {/* Existing comments */}
          {commentsLoaded && comments.length === 0 && (
            <p className="text-xs pt-3 text-center" style={{ color: 'var(--ryu-text-muted)' }}>
              No comments yet — be the first!
            </p>
          )}

          {comments.map(c => (
            <div key={c.id} className="flex gap-2 pt-3">
              {/* Avatar initial */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                style={{ background: 'var(--ryu-primary)', marginTop: 1 }}
              >
                {c.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--ryu-text)', fontFamily: "'Quicksand', sans-serif" }}
                  >
                    {c.name}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--ryu-text-muted)' }}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p
                  className="text-xs leading-relaxed mt-0.5"
                  style={{ color: 'var(--ryu-text-secondary)' }}
                >
                  {c.content}
                </p>
              </div>
            </div>
          ))}

          {/* New comment form */}
          <div
            className="flex flex-col gap-2 pt-2"
            style={{ borderTop: comments.length > 0 ? '0.5px solid var(--ryu-border)' : 'none' }}
          >
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
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment…"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                maxLength={1000}
                className="flex-1 h-8 px-3 rounded-lg text-xs outline-none"
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
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
                style={{
                  background: 'var(--ryu-primary)',
                  color: '#fff',
                  border: 'none',
                  opacity: (submitting || !name.trim() || !content.trim()) ? 0.4 : 1,
                }}
              >
                <Send size={13} />
              </button>
            </div>
            {submitError && (
              <p className="text-[10px]" style={{ color: '#dc2626' }}>{submitError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}