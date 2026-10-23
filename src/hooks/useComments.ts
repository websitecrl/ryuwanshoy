'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** The fields this hook relies on; components may carry more. */
export type BaseComment = {
  id: string
  parent_id: string | null
  created_at: string | null
}

/** One comment section: a series OR a post (illustration). */
export type CommentTarget = { seriesId: string } | { postId: string }

type Page<T> = { comments: T[]; total: number | null; nextCursor: string | null }

type State<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'loaded'
      topLevel: T[]  // newest first
      replies: T[]   // oldest first
      total: number
      nextCursor: string | null
    }

function targetQuery(target: CommentTarget): string {
  return 'seriesId' in target
    ? `series_id=${encodeURIComponent(target.seriesId)}`
    : `post_id=${encodeURIComponent(target.postId)}`
}

async function fetchPage<T>(target: CommentTarget, before?: string): Promise<Page<T>> {
  const cursor = before ? `&before=${encodeURIComponent(before)}` : ''
  const res = await fetch(`/api/comments?${targetQuery(target)}${cursor}`)
  if (!res.ok) throw new Error('Failed to load comments.')
  return await res.json() as Page<T>
}

/** one section: 30 top-level (+ replies) per page; add/edit/remove locally. add() needs status loaded */
export function useComments<T extends BaseComment>(target: CommentTarget) {
  const [state, setState] = useState<State<T>>({ status: 'loading' })
  const [loadingOlder, setLoadingOlder] = useState(false)
  const key = targetQuery(target)

  // old target or unmounted -> ignore response
  const generation = useRef(0)

  const reload = useCallback(async () => {
    const gen = ++generation.current
    setState({ status: 'loading' })
    setLoadingOlder(false)
    try {
      const page = await fetchPage<T>(target)
      if (gen !== generation.current) return
      setState({
        status: 'loaded',
        topLevel: page.comments.filter(c => !c.parent_id),
        replies: page.comments.filter(c => c.parent_id),
        total: page.total ?? page.comments.length,
        nextCursor: page.nextCursor,
      })
    } catch {
      if (gen === generation.current) setState({ status: 'error' })
    }
    // key stands in for target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void reload()
    return () => { generation.current++ }
  }, [reload])

  const loadOlder = useCallback(async () => {
    if (state.status !== 'loaded' || !state.nextCursor || loadingOlder) return
    const gen = generation.current
    setLoadingOlder(true)
    try {
      const page = await fetchPage<T>(target, state.nextCursor)
      if (gen !== generation.current) return
      setState(prev => {
        if (prev.status !== 'loaded') return prev
        const seen = new Set([...prev.topLevel, ...prev.replies].map(c => c.id))
        const fresh = page.comments.filter(c => !seen.has(c.id))
        return {
          ...prev,
          topLevel: [...prev.topLevel, ...fresh.filter(c => !c.parent_id)],
          replies: [...prev.replies, ...fresh.filter(c => c.parent_id)],
          nextCursor: page.nextCursor,
        }
      })
    } catch {
    } finally {
      if (gen === generation.current) setLoadingOlder(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state, loadingOlder])

  const add = useCallback((comment: T) => {
    setState(prev => {
      if (prev.status !== 'loaded') return prev
      return comment.parent_id
        ? { ...prev, replies: [...prev.replies, comment], total: prev.total + 1 }
        : { ...prev, topLevel: [comment, ...prev.topLevel], total: prev.total + 1 }
    })
  }, [])

  const remove = useCallback((id: string) => {
    setState(prev => {
      if (prev.status !== 'loaded') return prev
      const gone = (c: T) => c.id === id || c.parent_id === id
      const topLevel = prev.topLevel.filter(c => !gone(c))
      const replies = prev.replies.filter(c => !gone(c))
      const removed =
        prev.topLevel.length - topLevel.length + prev.replies.length - replies.length
      return { ...prev, topLevel, replies, total: Math.max(0, prev.total - removed) }
    })
  }, [])

  const edit = useCallback((id: string, content: string) => {
    const patch = (c: T) =>
      c.id === id ? { ...c, content, updated_at: new Date().toISOString() } : c
    setState(prev =>
      prev.status === 'loaded'
        ? { ...prev, topLevel: prev.topLevel.map(patch), replies: prev.replies.map(patch) }
        : prev
    )
  }, [])

  const repliesByParent = useMemo(() => {
    const map = new Map<string, T[]>()
    if (state.status === 'loaded') {
      for (const r of state.replies) {
        const list = map.get(r.parent_id as string) ?? []
        list.push(r)
        map.set(r.parent_id as string, list)
      }
    }
    return map
  }, [state])

  const repliesFor = useCallback(
    (parentId: string): T[] => repliesByParent.get(parentId) ?? [],
    [repliesByParent]
  )

  return {
    status: state.status,
    topLevel: state.status === 'loaded' ? state.topLevel : [],
    repliesFor,
    total: state.status === 'loaded' ? state.total : 0,
    hasMore: state.status === 'loaded' && state.nextCursor !== null,
    loadingOlder,
    loadOlder,
    reload,
    add,
    remove,
    edit,
  }
}
