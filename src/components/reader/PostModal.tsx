'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { X, Heart, Send, MessageCircle, Pencil, Trash2, CornerDownRight, Share2, ChevronLeft } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'

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

// ─── Comment ownership (edit_token) storage ──────────────────────────────────
// Same mechanism as SeriesComments.tsx: POST /api/comments issues a one-time
// edit_token, which we keep in localStorage so this browser (and only this
// browser) can later PATCH/DELETE that specific comment. There are no reader
// accounts — this token is the only proof of ownership.
const TOKEN_STORE = 'ryu.comment.tokens'

function getTokenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_STORE)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch { return {} }
}

function saveToken(commentId: string, token: string) {
  try {
    const map = getTokenMap()
    map[commentId] = token
    localStorage.setItem(TOKEN_STORE, JSON.stringify(map))
  } catch {
    // Not worth surfacing — worst case, edit/delete just won't persist
    // across a reload for this comment.
  }
}

function getToken(commentId: string): string | null {
  return getTokenMap()[commentId] ?? null
}

/**
 * Sends the request, checks res.ok, and throws a real Error carrying the
 * server's message (from the API's `{ error: string }` shape) on any
 * failure — HTTP error or network error alike. Every call site in this
 * file collapses to one try/catch instead of a hand-written `if (!res.ok)`
 * each time, which is exactly what went missing in submitEdit/submitReply
 * before (no catch at all, so a network failure became an unhandled
 * promise rejection instead of a toast).
 *
 * `status` is attached to the thrown error so callers that need to special-
 * case a status code (handleSubmit's 429 rate-limit message) still can.
 */
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

// ─── Single comment row (top-level or reply) ─────────────────────────────────

/**
 * Renders one comment: avatar, name, timestamp, content (or inline edit
 * form), and reply/edit/delete actions.
 *
 * - Reply is only offered at depth 0 — the `comments` table has no depth
 *   column, so replies-to-replies still attach to the same top-level parent
 *   (see repliesFor in PostModal below), matching SeriesComments.tsx.
 * - Edit/Delete only render when `isOwn` is true, i.e. this browser holds
 *   the edit_token for this exact comment.
 */
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

/**
 * Models the comment list's three real states explicitly, instead of using
 * a bare `Comment[]` where `[]` ambiguously means both "still loading" and
 * "genuinely zero comments." Before this, the UI would briefly show
 * "No comments yet" while the fetch was still in flight, because there was
 * no state distinguishing the two — this makes that collapse impossible
 * at the type level.
 */
type CommentsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; comments: Comment[] }

/**
 * Same reasoning as CommentsState: `liked: false` / `count: 0` as initial
 * values are indistinguishable from "we checked and it's really false/0."
 * Before this, someone who'd already liked the post would see the heart
 * render empty for a frame on reopen. It also closes a real race: without
 * a 'loaded' gate, the heart was clickable before the initial fetch
 * resolved, so a toggle request and the initial-state fetch could land in
 * either order and silently overwrite each other.
 */
type LikeState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; liked: boolean; count: number }

// Drag-down distance (px) on the mobile comments-panel handle past which we
// treat the gesture as "dismiss" rather than an aborted/accidental drag.
const DRAG_CLOSE_THRESHOLD = 80

export default function PostModal({ post, onClose }: Props) {
  const [likeState, setLikeState] = useState<LikeState>({ status: 'loading' })
  const [likeLoading, setLikeLoading] = useState(false)
  const [justLiked, setJustLiked] = useState(false)
  const likeRequestInFlightRef = useRef(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [commentsState, setCommentsState] = useState<CommentsState>({ status: 'loading' })
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set())
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Comments start hidden behind the like/comment/share rail on both
  // desktop (slide-in drawer) and mobile (full-screen swap) — see the
  // stage/panel layout in the JSX below.
  const [commentsOpen, setCommentsOpen] = useState(false)

  // Drag-to-dismiss for the mobile full-screen comments view. Only the
  // handle bar at the top of the panel listens for touch — NOT the panel
  // or the comment list itself — otherwise scrolling the comment list on
  // mobile would fight with closing the panel on every vertical touch move.
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
    if (delta > 0) setDragOffset(delta) // only track downward drags
  }
  function handleTouchEnd() {
    if (dragOffset > DRAG_CLOSE_THRESHOLD) setCommentsOpen(false)
    setDragOffset(0)
    draggingRef.current = false
    touchStartYRef.current = null
  }

  // Which comments (across ALL posts) this browser owns — read once on mount.
  useEffect(() => {
    setOwnIds(new Set(Object.keys(getTokenMap())))
  }, [])

  /**
   * Mutates the comment list only when it's actually loaded — a no-op
   * otherwise, since there's nothing to append/edit/remove from before the
   * first successful fetch. Centralizes every local-state comment mutation
   * (post, edit, delete, reply) through one place instead of five separate
   * `setComments` calls that each had to know the shape.
   */
  const updateLoadedComments = useCallback((updater: (comments: Comment[]) => Comment[]) => {
    setCommentsState(prev =>
      prev.status === 'loaded' ? { status: 'loaded', comments: updater(prev.comments) } : prev
    )
  }, [])

  // Initial (or retry) load — drives the loading → loaded/error transition.
  const loadComments = useCallback(async () => {
    setCommentsState({ status: 'loading' })
    try {
      const res = await fetch(`/api/comments?post_id=${post.id}`)
      if (!res.ok) throw new Error('Failed to load comments.')
      const data = await res.json() as Comment[]
      setCommentsState({ status: 'loaded', comments: Array.isArray(data) ? data : [] })
    } catch {
      setCommentsState({ status: 'error' })
    }
  }, [post.id])

  /**
   * Background reconciliation after a mutation (e.g. a delete that cascades
   * to replies server-side). Deliberately does NOT flip back to 'loading'
   * or 'error' — we already have a locally-updated list on screen, so a
   * failed background refresh should just leave it as-is rather than
   * regress the UI to a spinner or error state over a non-critical refresh.
   */
  const refetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?post_id=${post.id}`)
      if (!res.ok) return
      const data = await res.json() as Comment[]
      if (Array.isArray(data)) setCommentsState({ status: 'loaded', comments: data })
    } catch {
      // Non-fatal — local optimistic state stays as-is.
    }
  }, [post.id])

  // Load likes + comments on open
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

    loadComments()
  }, [post.id, loadComments])

  // ESC to close — closes the comments panel first if it's open, then the
  // whole modal, so ESC mirrors what the back-chevron / drag handle does.
  // (Reads commentsOpen directly rather than via a setState-updater side
  // effect, which React 18 Strict Mode double-invokes in dev and would
  // have called onClose() twice.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (commentsOpen) setCommentsOpen(false)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, commentsOpen])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // WCAG 2.3.3 — skip the like button's scale/particle animation for users
  // who've asked their OS for reduced motion; the heart still toggles state
  // instantly either way.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /**
   * Optimistic like/unlike: flips the visual state immediately (Instagram/
   * TikTok-style) instead of waiting on the network, then reconciles with
   * whatever the server actually recorded. A ref (not just `likeLoading`
   * state) guards re-entrancy so a fast double-tap can't fire two
   * conflicting toggle requests before the first render commits.
   */
  async function handleLike() {
    if (likeState.status !== 'loaded' || likeRequestInFlightRef.current) return
    likeRequestInFlightRef.current = true

    const previous = likeState
    const nextLiked = !previous.liked
    const nextCount = Math.max(0, previous.count + (nextLiked ? 1 : -1))

    setLikeState({ status: 'loaded', liked: nextLiked, count: nextCount })
    setLikeLoading(true)

    // Blown-heart pulse only plays on like, never unlike, and never for
    // reduced-motion users — they still get the instant filled/outline swap.
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
      if (!res.ok) throw new Error('Failed to update like.')
      const { liked: serverLiked, count: serverCount } = await res.json() as { liked: boolean; count: number }
      // Server is the source of truth — reconcile in case another tab/
      // request changed things in between.
      setLikeState({ status: 'loaded', liked: serverLiked, count: serverCount })
    } catch {
      // Never leave the UI showing a like the server doesn't have — revert
      // and say so, rather than fail silently.
      setLikeState(previous)
      toast.error('Could not update like — please try again.')
    } finally {
      setLikeLoading(false)
      likeRequestInFlightRef.current = false
    }
  }

  /**
   * Native share sheet when available (mobile browsers), clipboard copy
   * otherwise. There's no per-post deep link in this app yet (posts don't
   * have their own route), so this shares the current page URL — good
   * enough for "look what I found," not a permalink to this exact post.
   */
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
      // AbortError fires when the user just dismisses the native share
      // sheet — that's not a failure worth a toast.
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Could not share this post.')
      }
    }
  }

  async function handleSubmit() {
    const trimContent = content.trim()
    if (!trimContent || submitting) return

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

      updateLoadedComments(prev => [...prev, data])
      setContent('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      const status = err instanceof Error ? (err as Error & { status?: number }).status : undefined
      setSubmitError(
        status === 429
          ? 'One comment per minute — try again shortly.'
          : err instanceof Error ? err.message : 'Something went wrong.'
      )
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
      // Remove immediately for a snappy UI, then refetch — the DB cascades
      // parent_id on delete, so this also picks up any replies that just
      // got deleted along with it.
      updateLoadedComments(prev => prev.filter(c => c.id !== id))
      await refetchComments()
      toast.success('Comment deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment.')
    }
  }

  function handleEdit(id: string, newContent: string) {
    updateLoadedComments(prev =>
      prev.map(c => c.id === id
        ? { ...c, content: newContent, updated_at: new Date().toISOString() }
        : c
      )
    )
  }

  function handleReplyPosted(reply: Comment & { edit_token: string }) {
    if (reply.id && reply.edit_token) {
      saveToken(reply.id, reply.edit_token)
      setOwnIds(prev => new Set([...prev, reply.id]))
    }
    updateLoadedComments(prev => [...prev, reply])
  }

  // ── Separate top-level comments from replies ────────────────────────────────
  const comments = commentsState.status === 'loaded' ? commentsState.comments : []
  const topLevel = comments.filter(c => !c.parent_id)
  const repliesFor = (parentId: string) => comments.filter(c => c.parent_id === parentId)

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
        {/* Always-visible close button — dismisses the whole modal, from
            either the image stage or the comments panel. */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center post-modal-close"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none' }}
        >
          <X size={16} />
        </button>

        {/* Stage: flat image + floating like/comment/share rail + caption */}
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
              {/* Visible on desktop/web; hidden only in the compact mobile
                  icon-rail view (see the max-width: 640px block below). */}
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
              <span className="rail-count">{comments.length}</span>
            </button>

            <button type="button" onClick={handleShare} className="rail-btn" aria-label="Share">
              <span className="rail-icon-bg">
                <Share2 size={20} color="#fff" />
              </span>
            </button>
          </div>
        </div>

        {/* Comments panel — desktop: drawer sliding in from the right edge,
            image stays visible behind it. Mobile: full-screen, replaces the
            image entirely; drag the handle down (or tap it / the back
            chevron) to return to the image. */}
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
              Comments{comments.length > 0 ? ` (${comments.length})` : ''}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {commentsState.status === 'loading' ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--ryu-text-muted)' }}>
                Loading comments…
              </p>
            ) : commentsState.status === 'error' ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-xs" style={{ color: 'var(--ryu-text-muted)' }}>
                  Couldn&apos;t load comments.
                </p>
                <button
                  type="button"
                  onClick={loadComments}
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
              topLevel.map(comment => (
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
              ))
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
                disabled={submitting || !content.trim()}
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
              <p className="text-[10px]" style={{ color: '#dc2626' }}>{submitError}</p>
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
          /* Compact icon-rail view on mobile only — count stays visible on
             desktop/web. */
          .rail-count-like { display: none; }
          .post-modal-rail { right: 10px; gap: 16px; }
          .post-modal-close { width: 40px !important; height: 40px !important; }

          .post-modal-comments-panel {
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100%;
            /* Leaves the top ~20% of the screen as a peek of the image
               (rail included) behind the sheet, instead of covering the
               whole viewport — same idea as Instagram's comment sheet:
               comments never fully orphan you from what you're commenting
               on. */
            top: 20dvh;
            border-left: none;
            border-top: none;
            border-radius: 20px 20px 0 0;
            /* Without this the comments list's own scroll container still
               has square corners and pokes past the sheet's rounded ones
               at the top. */
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
