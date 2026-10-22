import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit-cf'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { isProfane } from '@/lib/profanity'
import { isCursor, readLimit } from '@/lib/cursor'
import { serverError } from '@/lib/api-errors'

// A comment is on a series or a post (chapter_id is a leftover and no longer accepted).
type CommentTarget = {
  seriesId?: string | null
  postId?:   string | null
}

// Top-level comments per page. Replies of those comments always come along.
const PAGE_SIZE = 30
const MAX_PAGE_SIZE = 50

const COMMENT_FIELDS = 'id, name, content, created_at, updated_at, parent_id'

/** True only for a published series or an existing post, so hidden content can't get comments by guessed id. */
async function isPublicTarget({ seriesId, postId }: CommentTarget): Promise<boolean> {
  if (seriesId) {
    const { data } = await supabaseAdmin
      .from('series')
      .select('id')
      .eq('id', seriesId)
      .eq('is_published', true)
      .maybeSingle()
    if (!data) return false
  }
  if (postId) {
    const { data } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle()
    if (!data) return false
  }
  return true
}

/** series_id XOR post_id, each a uuid; null otherwise. */
function readTarget(seriesId: unknown, postId: unknown): CommentTarget | null {
  const s = seriesId ? seriesId : null
  const p = postId ? postId : null
  if (!s === !p) return null // neither, or both
  if (s !== null && !isUuid(s)) return null
  if (p !== null && !isUuid(p)) return null
  return { seriesId: s as string | null, postId: p as string | null }
}

// GET ?series_id= | ?post_id= [&before=<cursor>] [&limit=1..50]
// One page of top-level comments, newest first, with all their replies: { comments, total, nextCursor }.
// total is only counted on the first page.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const target = readTarget(searchParams.get('series_id'), searchParams.get('post_id'))
  if (!target) {
    return NextResponse.json(
      { error: 'Exactly one of series_id or post_id is required' },
      { status: 400 }
    )
  }

  const before = searchParams.get('before')
  if (before !== null && !isCursor(before)) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
  }

  const limit = readLimit(searchParams.get('limit'), PAGE_SIZE, MAX_PAGE_SIZE)

  if (!(await isPublicTarget(target))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const targetColumn = target.seriesId ? 'series_id' : 'post_id'
  const targetId = (target.seriesId ?? target.postId) as string

  // One extra row tells us whether an older page exists.
  let topQuery = supabaseAdmin
    .from('comments')
    .select(COMMENT_FIELDS)
    .eq(targetColumn, targetId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (before) topQuery = topQuery.lt('created_at', before)

  const [topRes, countRes] = await Promise.all([
    topQuery,
    before
      ? Promise.resolve(null)
      : supabaseAdmin
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq(targetColumn, targetId),
  ])

  if (topRes.error) return serverError('GET /api/comments', topRes.error, 'Failed to load comments.')
  if (countRes?.error) return serverError('GET /api/comments', countRes.error, 'Failed to load comments.')

  const hasMore = topRes.data.length > limit
  const topLevel = hasMore ? topRes.data.slice(0, limit) : topRes.data

  let replies: typeof topLevel = []
  if (topLevel.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(COMMENT_FIELDS)
      .in('parent_id', topLevel.map(c => c.id))
      .order('created_at', { ascending: true })
    if (error) return serverError('GET /api/comments', error, 'Failed to load comments.')
    replies = data
  }

  const oldest = topLevel[topLevel.length - 1]
  return NextResponse.json({
    comments: [...topLevel, ...replies],
    total: countRes?.count ?? null,
    nextCursor: hasMore && oldest?.created_at ? oldest.created_at : null,
  })
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'COMMENT_LIMITER')
  if (limited) return limited

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const { series_id, post_id, content, parent_id } = body ?? {}
  const target = readTarget(series_id, post_id)

  if (!target || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (parent_id !== undefined && parent_id !== null && !isUuid(parent_id)) {
    return NextResponse.json({ error: 'Invalid parent.' }, { status: 400 })
  }
  const parentId = isUuid(parent_id) ? parent_id : null

  if (content.length > 300) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

  if (isProfane(content.trim())) {
    return NextResponse.json(
      { error: 'Your comment contains prohibited language.' },
      { status: 400 }
    )
  }

  if (!(await isPublicTarget(target))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  // Replies only to a top-level comment on the same target; anything else would never be shown.
  if (parentId) {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('comments')
      .select('id, parent_id, series_id, post_id')
      .eq('id', parentId)
      .maybeSingle()
    if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 })
    const sameTarget = target.seriesId
      ? parent?.series_id === target.seriesId
      : parent?.post_id === target.postId
    if (!parent || parent.parent_id !== null || !sameTarget) {
      return NextResponse.json({ error: 'Invalid parent.' }, { status: 400 })
    }
  }

  const edit_token = uuidv4()

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      series_id:  target.seriesId ?? null,
      post_id:    target.postId   ?? null,
      parent_id:  parentId,
      name:       'Anonymous',
      content:    content.trim(),
      edit_token,
    })
    .select(COMMENT_FIELDS)
    .single()

  if (error) return serverError('POST /api/comments', error, 'Failed to post comment.')
  return NextResponse.json({ ...data, edit_token }, { status: 201 })
}