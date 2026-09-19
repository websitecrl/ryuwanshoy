'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Send, MessageSquare, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/time'

// ─── Types ────────────────────────────────────────────────────────────────────

type Comment = {
  id: string
  name: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
}

type Props = {
  seriesId: string
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

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
  } catch {}
}

function getToken(commentId: string): string | null {
  return getTokenMap()[commentId] ?? null
}

// ─── Reply form ───────────────────────────────────────────────────────────────

function ReplyForm({
  parentId,
  seriesId,
  onPosted,
  onCancel,
}: {
  parentId: string
  seriesId: string
  onPosted: (comment: Comment & { edit_token: string }) => void
  onCancel: () => void
}) {
  const [content,    setContent]    = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimContent = content.trim()
    if (!trimContent) {
      toast.error('Please write a comment.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_id: seriesId,
          parent_id: parentId,
          name:      'Anonymous',
          content:   trimContent,
        }),
      })
      const data = await res.json() as Comment & { edit_token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to post reply.')

      toast.success('Reply posted!')
      onPosted({ ...data, edit_token: data.edit_token ?? '' })
      setContent('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 ml-11 space-y-2">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        maxLength={300}
        className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none
                   transition-colors bg-[var(--ryu-surface-2)] border-[var(--ryu-border)]
                   text-[var(--ryu-text)] placeholder:text-[var(--ryu-text-3)]
                   focus:border-[var(--ryu-primary)]"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded-md text-[var(--ryu-text-3)] hover:opacity-80"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md
                     bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]
                     disabled:opacity-40 hover:opacity-80 transition-opacity"
        >
          <Send size={11} />
          {submitting ? 'Posting…' : 'Reply'}
        </button>
      </div>
    </div>
  )
}

// ─── Single comment row ───────────────────────────────────────────────────────

function CommentRow({
  comment,
  replies,
  isOwn,
  ownIds,
  onDelete,
  onEdit,
  seriesId,
  onReplyPosted,
  depth,
}: {
  comment: Comment
  replies: Comment[]
  isOwn: boolean
  ownIds: Set<string>
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
  seriesId: string
  onReplyPosted: (reply: Comment & { edit_token: string }) => void
  depth: number
}) {
  const [editing,     setEditing]     = useState(false)
  const [draft,       setDraft]       = useState(comment.content)
  const [saving,      setSaving]      = useState(false)
  const [showReply,   setShowReply]   = useState(false)

  async function submitEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === comment.content) { setEditing(false); return }

    setSaving(true)
    const token = getToken(comment.id)
    if (!token) { toast.error('Edit token not found.'); setSaving(false); return }

    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, edit_token: token }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error ?? 'Failed to update')
      }
      onEdit(comment.id, trimmed)
      setEditing(false)
      toast.success('Comment updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={depth > 0 ? 'ml-11 mt-3' : ''}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                        text-xs font-bold uppercase select-none
                        bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]">
          {comment.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + timestamp */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--ryu-text)]">
              {comment.name}
            </span>
            <span className="text-xs text-[var(--ryu-text-3)]">
              {timeAgo(comment.created_at)}
              {comment.updated_at && comment.updated_at !== comment.created_at && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
          </div>

          {/* Content or edit */}
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none
                           transition-colors bg-[var(--ryu-surface-2)] border-[var(--ryu-border)]
                           text-[var(--ryu-text)] focus:border-[var(--ryu-primary)]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={submitEdit}
                  disabled={saving || !draft.trim()}
                  className="px-3 py-1 text-xs font-semibold rounded-md
                             bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]
                             disabled:opacity-50 hover:opacity-80 transition-opacity"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setDraft(comment.content) }}
                  className="px-3 py-1 text-xs rounded-md text-[var(--ryu-text-3)] hover:opacity-80"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-relaxed break-words text-[var(--ryu-text-2)]">
              {comment.content}
            </p>
          )}

          {/* Action row — Reply + edit/delete */}
          {!editing && (
            <div className="flex items-center gap-3 mt-1.5">
              {/* Reply button — only on top-level comments */}
              {depth === 0 && (
                <button
                  onClick={() => setShowReply(s => !s)}
                  className="flex items-center gap-1 text-xs text-[var(--ryu-text-3)]
                             hover:text-[var(--ryu-primary)] transition-colors"
                >
                  <CornerDownRight size={11} />
                  {showReply ? 'Cancel' : 'Reply'}
                </button>
              )}

              {/* Edit / delete */}
              {isOwn && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-[var(--ryu-text-3)]
                               hover:text-[var(--ryu-text)] transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="flex items-center gap-1 text-xs text-[var(--ryu-text-3)]
                               hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline reply form */}
      {showReply && (
        <ReplyForm
          parentId={comment.id}
          seriesId={seriesId}
          onPosted={(reply) => {
            onReplyPosted(reply)
            setShowReply(false)
          }}
          onCancel={() => setShowReply(false)}
        />
      )}

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="mt-3 border-l-2 border-[var(--ryu-border-soft)] pl-4 space-y-4">
          {replies.map(reply => (
            <CommentRow
              key={reply.id}
              comment={reply}
              replies={[]}
              isOwn={ownIds.has(reply.id)}
              ownIds={ownIds}
              onDelete={onDelete}
              onEdit={onEdit}
              seriesId={seriesId}
              onReplyPosted={onReplyPosted}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SeriesComments({ seriesId }: Props) {
  const [comments,   setComments]   = useState<Comment[]>([])
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content,    setContent]    = useState('')
  const [ownIds,     setOwnIds]     = useState<Set<string>>(new Set())

  useEffect(() => {
    const map = getTokenMap()
    setOwnIds(new Set(Object.keys(map)))
  }, [])

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?series_id=${seriesId}`)
      if (!res.ok) return
      const data = await res.json() as Comment[]
      setComments(data)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [seriesId])

  useEffect(() => { fetchComments() }, [fetchComments])


  async function handleSubmit() {
    const trimContent = content.trim()
    if (!trimContent) {
      toast.error('Please write a comment.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: seriesId, name: 'Anonymous', content: trimContent }),
      })
      const data = await res.json() as Comment & { edit_token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to post comment.')

      if (data.id && data.edit_token) {
        saveToken(data.id, data.edit_token)
        setOwnIds(prev => new Set([...prev, data.id]))
      }

      setContent('')
      toast.success('Comment posted!')
      await fetchComments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const token = getToken(id)
    if (!token) { toast.error('You cannot delete this comment.'); return }

    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: token }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error ?? 'Delete failed.')
      }
      setComments(prev => prev.filter(c => c.id !== id))
      toast.success('Comment deleted.')
      await fetchComments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment.')
    }
  }

  function handleEdit(id: string, newContent: string) {
    setComments(prev =>
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
    setComments(prev => [...prev, reply])
  }

  // ── Separate top-level comments from replies ────────────────────────────────
  const topLevel = comments.filter(c => !c.parent_id)
  const repliesFor = (parentId: string) =>
    comments.filter(c => c.parent_id === parentId)

  const totalCount = comments.length

  return (
    <div className="w-full bg-[var(--ryu-surface-1)] border-t border-[var(--ryu-border)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-10 pb-10 space-y-6">

    {/* Header */}
    <div className="flex items-center gap-2">
      <MessageSquare size={18} className="text-[var(--ryu-primary)]" />
      <h2 className="text-base font-bold text-[var(--ryu-text)]">
        Comments
        {totalCount > 0 && (
          <span className="ml-1.5 text-sm font-normal text-[var(--ryu-text-3)]">
            · {totalCount}
          </span>
        )}
      </h2>
    </div>

    {/* Comment form */}
    <div className="rounded-xl border border-[var(--ryu-border)] p-4 space-y-3 bg-[var(--ryu-surface-1)]">
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ryu-text-2)]">
          Comment
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What do you think of this series?"
          rows={3}
          maxLength={300}
          className="w-full text-sm rounded-lg border px-3 py-2 resize-none
                    outline-none transition-colors bg-[var(--ryu-surface-2)]
                    border-[var(--ryu-border)] text-[var(--ryu-text)]
                    placeholder:text-[var(--ryu-text-3)]
                    focus:border-[var(--ryu-primary)]"
        />
        <p className="text-right text-xs text-[var(--ryu-text-3)]">
          {content.length} / 300
        </p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold
                    bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]
                    hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          <Send size={14} />
          {submitting ? 'Posting…' : 'Post Comment'}
        </button>
      </div>
    </div>
        {/* Comment list */}
        <div>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[var(--ryu-surface-3)] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-[var(--ryu-surface-3)]" />
                    <div className="h-3 w-full rounded bg-[var(--ryu-surface-3)]" />
                    <div className="h-3 w-3/4 rounded bg-[var(--ryu-surface-3)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : topLevel.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[var(--ryu-text-3)]">
                No comments yet. Be the first!
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--ryu-border)] overflow-hidden
                            bg-[var(--ryu-surface-1)] divide-y divide-[var(--ryu-border-soft)]">
              {topLevel.map(comment => (
                <div key={comment.id} className="px-4 py-4">
                  <CommentRow
                    comment={comment}
                    replies={repliesFor(comment.id)}
                    isOwn={ownIds.has(comment.id)}
                    ownIds={ownIds}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    seriesId={seriesId}
                    onReplyPosted={handleReplyPosted}
                    depth={0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
  )
}