import 'server-only'
import { supabaseAdmin } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from "@/lib/rate-limit-cf"
import { serverError } from '@/lib/api-errors'
import { isUuid } from '@/lib/validation'

// count + liked by this token?
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postId    = searchParams.get('post_id')
  const likeToken = searchParams.get('like_token')

  if (!isUuid(postId)) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
  }

  const { count } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  let liked = false
  if (isUuid(likeToken)) {
    const { data } = await supabaseAdmin
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('like_token', likeToken)
      .maybeSingle()
    liked = !!data
  }

  return NextResponse.json({ count: count ?? 0, liked })
}

// toggle like
export async function POST(req: NextRequest) {
  // 20 per IP per minute (LIKE_LIMITER)
  const limited = await rateLimit(req, 'LIKE_LIMITER')
  if (limited) return limited

  let body: { post_id?: unknown; like_token?: unknown } | null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const post_id = body?.post_id
  const like_token = body?.like_token

  // like_token is the browser's uuidv4 (PostModal getLikeToken)
  if (!isUuid(post_id) || !isUuid(like_token)) {
    return NextResponse.json({ error: 'post_id and like_token are required' }, { status: 400 })
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('likes')
    .select('id')
    .eq('post_id', post_id)
    .eq('like_token', like_token)
    .maybeSingle()

  if (lookupError) return serverError('POST /api/likes', lookupError, 'Failed to save like.')

  if (existing) {
    const { error: deleteError } = await supabaseAdmin.from('likes').delete().eq('id', existing.id)
    if (deleteError) return serverError('POST /api/likes', deleteError, 'Failed to remove like.')
    const { count } = await supabaseAdmin
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post_id)
    return NextResponse.json({ liked: false, count: count ?? 0 })
  }

  const { error: insertError } = await supabaseAdmin
    .from('likes')
    // duplicate -> ignored
    .upsert({ post_id, like_token }, { onConflict: 'post_id,like_token', ignoreDuplicates: true })

  if (insertError) {
    return serverError('POST /api/likes', insertError, 'Failed to save like.')
  }

  const { count } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
  return NextResponse.json({ liked: true, count: count ?? 0 })
}
