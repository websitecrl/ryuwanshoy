'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useComments } from '@/hooks/useComments'
import Image from 'next/image'
import { X, Heart, Send, MessageCircle, Pencil, Trash2, CornerDownRight, Share2, ChevronLeft } from 'lucide-react'
import { timeAgo, formatDate } from '@/lib/time'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import { toastRateLimited } from '@/lib/rate-limit-toast'
import { getToken, getTokenMap, saveToken } from '@/lib/comment-tokens'

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
  updated_at: string | null
  parent_id: string | null
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

/** fetch that throws an Error with the server's message (and `status`) on any HTTP or network failure. */
async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return data as T
}

/** True when fetchJson threw because a Workers rate limiter returned 429. */
function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 429
}


/** One comment. Reply only at depth 0 (no depth column); edit/delete only when this browser owns it. */
function CommentRow({
  comment,
  replies,
  isOwn,
  ownIds,
  postId,
  onDelete,
  onEdit,
  onReplyPosted,
  depth,
}: {
  comment: Comment
  replies: Comment[]
  isOwn: boolean
  ownIds: Set<string>
  postId: string
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
  onReplyPosted: (reply: Comment & { edit_token: string }) => void
  depth: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  async function submitEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === comment.content) { setEditing(false); return }

    const token = getToken(comment.id)
    if (!token) { toast.error('You can only edit your own comments.'); return }

    setSaving(true)
    try {
      await fetchJson(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, edit_token: token }),
      })
      onEdit(comment.id, trimmed)
      setEditing(false)
      toast.success('Comment updated.')
    } catch (err) {
      if (isRateLimitError(err)) { toastRateLimited(); return }
      toast.error(err instanceof Error ? err.message : 'Failed to update comment.')
    } finally {
      setSaving(false)
    }
  }

  async function submitReply() {
    const trimmed = replyContent.trim()
    if (!trimmed || replySubmitting) return

    setReplySubmitting(true)
    try {
      const data = await fetchJson<Comment & { edit_token?: string }>('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, parent_id: comment.id, content: trimmed }),
      })
      onReplyPosted({ ...data, edit_token: data.edit_token ?? '' })
      setReplyContent('')
      setShowReply(false)
      toast.success('Reply posted!')
    } catch (err) {
      if (isRateLimitError(err)) { toastRateLimited(); return }
      toast.error(err instanceof Error ? err.message : 'Failed to post reply.')
    } finally {
      setReplySubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2" style={{ marginLeft: depth > 0 ? 28 : 0 }}>
      <div className="flex gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 uppercase comment-avatar"
          style={{ background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)' }}
        >
          {comment.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="text-xs font-semibold comment-name"
              style={{ color: 'var(--ryu-text)', fontFamily: "var(--font-fredoka), sans-serif" }}
            >
              {comment.name}
            </span>
            <span className="text-[10px] comment-time" style={{ color: 'var(--ryu-text-muted)' }}>
              {timeAgo(comment.created_at)}
              {comment.updated_at && comment.updated_at !== comment.created_at && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
          </div>

          {editing ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                maxLength={300}
                autoFocus
                className="w-full text-xs rounded-lg px-2 py-1.5 resize-none outline-none"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-2)',
                  color: 'var(--ryu-text)',
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(comment.content) }}
                  disabled={saving}
                  className="text-[10px]"
                  style={{ color: 'var(--ryu-text-muted)', background: 'none', border: 'none' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={saving || !draft.trim()}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md"
                  style={{
                    background: 'var(--ryu-primary)',
                    color: '#fff',
                    border: 'none',
                    opacity: saving || !draft.trim() ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed mt-0.5 comment-content" style={{ color: 'var(--ryu-text-secondary)' }}>
              {comment.content}
            </p>
          )}

          {!editing && (
            <div className="flex items-center gap-2 mt-1">
              {depth === 0 && (
                <button
                  type="button"
                  onClick={() => setShowReply(s => !s)}
                  className="flex items-center gap-1 text-[10px] comment-action-btn"
                  style={{ color: 'var(--ryu-text-muted)', background: 'none', border: 'none' }}
                >
                  <CornerDownRight size={10} />
                  {showReply ? 'Cancel' : 'Reply'}
                </button>
              )}

              {isOwn && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-[10px] comment-action-btn"
                    style={{ color: 'var(--ryu-text-muted)', background: 'none', border: 'none' }}
                  >
                    <Pencil size={10} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(comment.id)}
                    className="flex items-center gap-1 text-[10px] comment-action-btn"
                    style={{ color: 'var(--ryu-text-muted)', background: 'none', border: 'none' }}
                  >
                    <Trash2 size={10} /> Delete
                  </button>
                </>
              )}
            </div>
          )}

          {showReply && (
            <div className="flex gap-1.5 mt-1.5">
              <input
                type="text"
                placeholder="Write a reply…"
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReply() }}
                maxLength={300}
                autoFocus
                className="flex-1 h-7 px-2 rounded-md text-[11px] outline-none comment-reply-input"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-2)',
                  color: 'var(--ryu-text)',
                }}
              />
              <button
                type="button"
                onClick={submitReply}
                disabled={replySubmitting || !replyContent.trim()}
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 comment-reply-send"
                style={{
                  background: 'var(--ryu-primary)',
                  color: '#fff',
                  border: 'none',
                  opacity: replySubmitting || !replyContent.trim() ? 0.4 : 1,
                }}
              >
                <Send size={11} />
              </button>
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div
          className="flex flex-col gap-2 mt-1"
          style={{ borderLeft: '2px solid var(--ryu-border)', paddingLeft: 10, marginLeft: 28 }}
        >
          {replies.map(reply => (
            <CommentRow
              key={reply.id}
              comment={reply}
              replies={[]}
              isOwn={ownIds.has(reply.id)}
              ownIds={ownIds}
              postId={postId}
              onDelete={onDelete}
              onEdit={onEdit}
              onReplyPosted={onReplyPosted}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  post: Post
  onClose: () => void
}

// 'loading' is its own state so the heart can't flash empty or be toggled before the first fetch lands.
type LikeState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; liked: boolean; count: number }

// Drag distance (px) on the mobile handle that counts as dismiss.
const DRAG_CLOSE_THRESHOLD = 80

export default function PostModal({ post, onClose }: Props) {
  const [likeState, setLikeState] = useState<LikeState>({ status: 'loading' })
  const [likeLoading, setLikeLoading] = useState(false)
  const [justLiked, setJustLiked] = useState(false)
  const likeRequestInFlightRef = useRef(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  // Newest 30 top-level comments, shown oldest-first like a chat.
  const thread = useComments<Comment>({ postId: post.id })
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set())
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const commentsListRef = useRef<HTMLDivElement>(null)
  // Distance from the bottom, saved before "Show older" prepends comments.
  const scrollFromBottomRef = useRef<number | null>(null)

  const [commentsOpen, setCommentsOpen] = useState(false)

  // Only the handle listens for touch, so scrolling the list never fights with closing.
  const [dragOffset, setDragOffset] = useState(0)
  const draggingRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    touchStartYRef.current = touch.clientY
    draggingRef.current = true
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current || touchStartYRef.current === null) return
    const touch = e.touches[0]
    if (!touch) return
    const delta = touch.clientY - touchStartYRef.current
    if (delta > 0) setDragOffset(delta)
  }
  function handleTouchEnd() {
    if (dragOffset > DRAG_CLOSE_THRESHOLD) setCommentsOpen(false)
    setDragOffset(0)
    draggingRef.current = false
    touchStartYRef.current = null
  }

  useEffect(() => {
    setOwnIds(new Set(Object.keys(getTokenMap())))
  }, [])

  useEffect(() => {
    const likeToken = getLikeToken()
    fetch(`/api/likes?post_id=${post.id}&like_token=${likeToken}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load like state.')
        return r.json() as Promise<{ count: number; liked: boolean }>
      })
      .then(({ count, liked }) => {
        setLikeState({ status: 'loaded', liked, count })
      })
      .catch(() => setLikeState({ status: 'error' }))
  }, [post.id])

  // ESC closes the comments panel first, then the modal. Reads commentsOpen directly: an updater would run twice in Strict Mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (commentsOpen) setCommentsOpen(false)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, commentsOpen])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Skip the like animation for reduced motion (WCAG 2.3.3).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /** Optimistic like: flip now, reconcile with the server. A ref blocks double taps. */
  async function handleLike() {
    if (likeState.status !== 'loaded' || likeRequestInFlightRef.current) return
    likeRequestInFlightRef.current = true

    const previous = likeState
    const nextLiked = !previous.liked
    const nextCount = Math.max(0, previous.count + (nextLiked ? 1 : -1))

    setLikeState({ status: 'loaded', liked: nextLiked, count: nextCount })
    setLikeLoading(true)

    if (nextLiked && !reduceMotion) {
      setJustLiked(true)
      setTimeout(() => setJustLiked(false), 320)
    }

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, like_token: getLikeToken() }),
      })
      if (res.status === 429) {
        setLikeState(previous)
        toastRateLimited()
        return
      }
      if (!res.ok) throw new Error('Failed to update like.')
      const { liked: serverLiked, count: serverCount } = await res.json() as { liked: boolean; count: number }
      setLikeState({ status: 'loaded', liked: serverLiked, count: serverCount })
    } catch {
      setLikeState(previous)
      toast.error('Could not update like — please try again.')
    } finally {
      setLikeLoading(false)
      likeRequestInFlightRef.current = false
    }
  }

  /** Native share sheet, else copy the page URL (posts have no own route yet). */
  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (!url) return

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post.title ?? 'Ryuwanshoy', text: post.description ?? undefined, url })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied!')
      }
    } catch (err) {
      // AbortError = the reader closed the share sheet.
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Could not share this post.')
      }
    }
  }

  async function handleSubmit() {
    const trimContent = content.trim()
    if (!trimContent || submitting || thread.status !== 'loaded') return

    setSubmitting(true)
    setSubmitError('')
    try {
      const data = await fetchJson<Comment & { edit_token?: string }>('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, content: trimContent }),
      })

      if (data.id && data.edit_token) {
        saveToken(data.id, data.edit_token)
        setOwnIds(prev => new Set([...prev, data.id]))
      }

      thread.add(data)
      setContent('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      if (isRateLimitError(err)) { toastRateLimited(); return }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const token = getToken(id)
    if (!token) { toast.error('You can only delete your own comments.'); return }
    try {
      await fetchJson(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: token }),
      })
      // The DB cascades replies, so no refetch.
      thread.remove(id)
      toast.success('Comment deleted.')
    } catch (err) {
      if (isRateLimitError(err)) { toastRateLimited(); return }
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment.')
    }
  }

  function handleEdit(id: string, newContent: string) {
    thread.edit(id, newContent)
  }

  function handleReplyPosted(reply: Comment & { edit_token: string }) {
    if (reply.id && reply.edit_token) {
      saveToken(reply.id, reply.edit_token)
      setOwnIds(prev => new Set([...prev, reply.id]))
    }
    thread.add(reply)
  }

  function handleLoadOlder() {
    const list = commentsListRef.current
    if (list) scrollFromBottomRef.current = list.scrollHeight - list.scrollTop
    void thread.loadOlder()
  }

  // Keep the same distance from the bottom after older comments load above (Safari has no scroll anchoring).
  useLayoutEffect(() => {
    const list = commentsListRef.current
    if (thread.loadingOlder || !list || scrollFromBottomRef.current === null) return
    list.scrollTop = list.scrollHeight - scrollFromBottomRef.current
    scrollFromBottomRef.current = null
  }, [thread.loadingOlder])

  const topLevel = [...thread.topLevel].reverse()
  const { repliesFor } = thread
  const commentCount = thread.total

  const liked = likeState.status === 'loaded' && likeState.liked
  const likeCount = likeState.status === 'loaded' ? likeState.count : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden post-modal-inner"
        style={{
          background: 'var(--ryu-surface-1)',
          borderRadius: 12,
          width: 'min(1040px, 96vw)',
          height: 'min(680px, 88vh)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center post-modal-close"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none' }}
        >
          <X size={16} />
        </button>

        <div className="post-modal-stage">
          <div className="post-modal-image-wrap">
            <Image
              src={post.image_url}
              alt={post.title ?? 'Post'}
              fill
              sizes="(max-width: 640px) 100vw, 1040px"
              className="object-contain"
            />
          </div>

          {(post.title || post.description) && (
            <div className="post-modal-caption">
              {post.title && <p className="post-modal-caption-title">{post.title}</p>}
              <p className="post-modal-caption-date">{formatDate(post.created_at)}</p>
              {post.description && <p className="post-modal-caption-desc">{post.description}</p>}
            </div>
          )}

          <div className="post-modal-rail">
            <button
              type="button"
              onClick={handleLike}
              disabled={likeLoading || likeState.status !== 'loaded'}
              className="rail-btn"
              aria-label={liked ? 'Unlike this post' : 'Like this post'}
            >
              <span className={`rail-icon-bg${justLiked ? ' rail-icon-pop' : ''}`}>
                <Heart size={22} fill={liked ? '#f43f5e' : 'none'} stroke={liked ? '#f43f5e' : '#fff'} strokeWidth={2} />
                {justLiked && (
                  <span className="like-particles" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className="like-particle" style={{ '--angle': `${i * 60}deg` } as React.CSSProperties} />
                    ))}
                  </span>
                )}
              </span>
              {likeCount > 0 && <span className="rail-count rail-count-like">{likeCount.toLocaleString()}</span>}
            </button>

            <button
              type="button"
              onClick={() => setCommentsOpen(open => !open)}
              className="rail-btn"
              aria-label="Comments"
            >
              <span className="rail-icon-bg">
                <MessageCircle size={22} color="#fff" />
              </span>
              <span className="rail-count">{commentCount}</span>
            </button>

            <button type="button" onClick={handleShare} className="rail-btn" aria-label="Share">
              <span className="rail-icon-bg">
                <Share2 size={20} color="#fff" />
              </span>
            </button>
          </div>
        </div>

        {/* Comments: a drawer on desktop, full screen on mobile (drag the handle down to close). */}
        <div
          className={`post-modal-comments-panel ${commentsOpen ? 'open' : ''}`}
          style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined}
        >
          <div
            className="comments-drag-handle"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setCommentsOpen(false)}
          >
            <span className="drag-pill" />
          </div>

          <div className="comments-panel-header">
            <button
              type="button"
              onClick={() => setCommentsOpen(false)}
              className="comments-back-btn"
              aria-label="Back to image"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="comments-panel-title">
              Comments{commentCount > 0 ? ` (${commentCount})` : ''}
            </span>
          </div>

          <div ref={commentsListRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {thread.status === 'loading' ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--ryu-text-muted)' }}>
                Loading comments…
              </p>
            ) : thread.status === 'error' ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-xs" style={{ color: 'var(--ryu-text-muted)' }}>
                  Couldn&apos;t load comments.
                </p>
                <button
                  type="button"
                  onClick={() => void thread.reload()}
                  className="text-xs underline"
                  style={{ color: 'var(--ryu-primary)', background: 'none', border: 'none' }}
                >
                  Retry
                </button>
              </div>
            ) : topLevel.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--ryu-text-muted)' }}>
                No comments yet — be the first!
              </p>
            ) : (
              <>
                {thread.hasMore && (
                  <button
                    type="button"
                    onClick={handleLoadOlder}
                    disabled={thread.loadingOlder}
                    className="self-center text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{
                      color: 'var(--ryu-primary)',
                      background: 'var(--ryu-surface-2)',
                      border: '0.5px solid var(--ryu-border)',
                    }}
                  >
                    {thread.loadingOlder ? 'Loading…' : 'Show older comments'}
                  </button>
                )}
                {topLevel.map(comment => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    replies={repliesFor(comment.id)}
                    isOwn={ownIds.has(comment.id)}
                    ownIds={ownIds}
                    postId={post.id}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onReplyPosted={handleReplyPosted}
                    depth={0}
                  />
                ))}
              </>
            )}
            <div ref={commentsEndRef} />
          </div>

          <div
            className="shrink-0 px-4 py-3 flex flex-col gap-2"
            style={{ borderTop: '0.5px solid var(--ryu-border)' }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment…"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                maxLength={300}
                className="flex-1 h-9 px-3 rounded-lg text-xs outline-none post-comment-input"
                style={{
                  border: '0.5px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-2)',
                  color: 'var(--ryu-text)',
                  fontFamily: "var(--font-fredoka), sans-serif",
                }}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !content.trim() || thread.status !== 'loaded'}
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 post-comment-send"
                style={{
                  background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)', border: 'none',
                  opacity: (submitting || !content.trim()) ? 0.4 : 1,
                  cursor: (submitting || !content.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                <Send size={14} />
              </button>
            </div>

            {submitError && (
              <p className="text-[10px]" style={{ color: 'var(--ryu-danger)' }}>{submitError}</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .post-modal-stage {
          position: absolute;
          inset: 0;
          background: #0d0d18;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .post-modal-image-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .post-modal-caption {
          position: absolute;
          left: 14px;
          right: 84px;
          bottom: 14px;
          z-index: 3;
          background: linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0));
          padding: 30px 12px 10px;
          border-radius: 8px;
          pointer-events: none;
        }
        .post-modal-caption-title {
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          margin: 0 0 2px;
          font-family: var(--font-fredoka), sans-serif;
        }
        .post-modal-caption-date {
          color: rgba(255,255,255,0.7);
          font-size: 10px;
          margin: 0 0 4px;
        }
        .post-modal-caption-desc {
          color: rgba(255,255,255,0.92);
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
          max-height: 4.5em;
          overflow: hidden;
        }
        .post-modal-rail {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
          z-index: 4;
        }
        .rail-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .rail-icon-bg {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.42);
          transition: transform 0.12s ease;
        }
        .rail-btn:active .rail-icon-bg { transform: scale(0.9); }
        .rail-btn:disabled { cursor: not-allowed; opacity: 0.6; }
        .rail-icon-pop { animation: rail-like-pop 300ms ease; }
        @keyframes rail-like-pop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .like-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .like-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #f43f5e;
          transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(1);
          opacity: 1;
          animation: like-particle-burst 400ms ease-out forwards;
        }
        @keyframes like-particle-burst {
          to {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-20px) scale(0);
            opacity: 0;
          }
        }
        .rail-count {
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }
        .post-modal-comments-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 380px;
          max-width: 92vw;
          display: flex;
          flex-direction: column;
          background: var(--ryu-surface-1);
          border-left: 0.5px solid var(--ryu-border);
          transform: translateX(100%);
          transition: transform 0.28s ease;
          z-index: 10;
        }
        .post-modal-comments-panel.open { transform: translateX(0); }
        .comments-drag-handle { display: none; }
        .comments-panel-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          border-bottom: 0.5px solid var(--ryu-border);
          flex-shrink: 0;
        }
        .comments-back-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--ryu-text);
          cursor: pointer;
        }
        .comments-panel-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--ryu-text);
          font-family: var(--font-fredoka), sans-serif;
        }

        @media (max-width: 640px) {
          .post-modal-inner {
            width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
          }
          .post-modal-caption { right: 68px; }
          .rail-icon-bg { width: 40px; height: 40px; }
          .rail-count-like { display: none; }
          .post-modal-rail { right: 10px; gap: 16px; }
          .post-modal-close { width: 40px !important; height: 40px !important; }

          .post-modal-comments-panel {
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100%;
            /* Leaves the top 20% of the image visible, like Instagram's comment sheet. */
            top: 20dvh;
            border-left: none;
            border-top: none;
            border-radius: 20px 20px 0 0;
            /* Keeps the list's square corners inside the sheet's rounded ones. */
            overflow: hidden;
            box-shadow: 0 -8px 24px rgba(0,0,0,0.35);
            transform: translateY(100%);
          }
          .post-modal-comments-panel.open { transform: translateY(0); }
          .comments-drag-handle {
            display: flex;
            justify-content: center;
            padding: 10px 0 6px;
            touch-action: none;
            cursor: grab;
            flex-shrink: 0;
          }
          .drag-pill {
            width: 36px;
            height: 4px;
            border-radius: 999px;
            background: var(--ryu-border);
          }
          .comment-avatar { width: 32px !important; height: 32px !important; font-size: 0.75rem !important; }
          .comment-name { font-size: 0.875rem !important; }
          .comment-time { font-size: 0.75rem !important; }
          .comment-content { font-size: 0.875rem !important; }
          .comment-action-btn { font-size: 0.75rem !important; padding: 6px 4px !important; }
          .post-comment-input, .comment-reply-input {
            height: 44px !important;
            font-size: 0.9rem !important;
          }
          .post-comment-send, .comment-reply-send {
            width: 44px !important;
            height: 44px !important;
          }
        }
      `}</style>
    </div>
  )
}
