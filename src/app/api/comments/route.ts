import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit-cf'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isProfane } from '@/lib/profanity'

type CommentTarget = {
  chapterId?: string | null
  seriesId?:  string | null
  postId?:    string | null
}

/**
 * True only when every target given is visible to readers: a chapter must be
 * published, not a draft, and in a published series (same rule as the reader
 * pages); a series must be published. Posts have no publish flag, so a post
 * only has to exist. Stops comments being read or posted on hidden content
 * by guessed id.
 */
async function isPublicTarget({ chapterId, seriesId, postId }: CommentTarget): Promise<boolean> {
  if (chapterId) {
    const { data } = await supabaseAdmin
      .from('chapters')
      .select('id, series:series_id!inner (is_published)')
      .eq('id', chapterId)
      .eq('is_published', true)
      .eq('is_draft', false)
      .eq('series.is_published', true)
      .maybeSingle()
    if (!data) return false
  }
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

// ─── GET /api/comments ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chapterId = searchParams.get('chapter_id')
  const postId    = searchParams.get('post_id')
  const seriesId  = searchParams.get('series_id')

  if (!chapterId && !postId && !seriesId) {
    return NextResponse.json(
      { error: 'chapter_id, post_id, or series_id is required' },
      { status: 400 }
    )
  }

  if (!(await isPublicTarget({ chapterId, seriesId, postId }))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let query = supabaseAdmin
    .from('comments')
    .select('id, name, content, created_at, updated_at, parent_id')
    .order('created_at', { ascending: true })

  if (chapterId) query = query.eq('chapter_id', chapterId)
  if (postId)    query = query.eq('post_id', postId)
  if (seriesId)  query = query.eq('series_id', seriesId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── POST /api/comments ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'COMMENT_LIMITER')
  if (limited) return limited

  const body = await req.json()
  const { chapter_id, series_id, post_id, content, parent_id } = body

  if ((!chapter_id && !post_id && !series_id) || !content?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (content.length > 300) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

  if (isProfane(content.trim())) {
    return NextResponse.json(
      { error: 'Your comment contains prohibited language.' },
      { status: 400 }
    )
  }

  if (!(await isPublicTarget({ chapterId: chapter_id, seriesId: series_id, postId: post_id }))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const edit_token = uuidv4()

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      chapter_id: chapter_id ?? null,
      series_id:  series_id  ?? null,
      post_id:    post_id    ?? null,
      parent_id:  parent_id  ?? null,
      name:       'Anonymous',
      content:    content.trim(),
      edit_token,
    })
    .select('id, name, content, created_at, updated_at, parent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, edit_token }, { status: 201 })
}