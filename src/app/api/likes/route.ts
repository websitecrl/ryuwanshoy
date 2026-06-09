import 'server-only'
import { supabaseAdmin } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from "@/lib/rate-limit"
import { error } from "console"

// GET — get like count + check if token already liked
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postId    = searchParams.get('post_id')
  const likeToken = searchParams.get('like_token')

  if (!postId) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
  }

  const { count } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  let liked = false
  if (likeToken) {
    const { data } = await supabaseAdmin
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('like_token', likeToken)
      .single()
    liked = !!data
  }

  return NextResponse.json({ count: count ?? 0, liked })
}

// POST — toggle like
export async function POST(req: NextRequest) {
  const ip = req.headers.get('CF-Connecting-IP')
       ?? req.headers.get('x-forwarded-for')
       ?? 'unknown'

  if (!checkRateLimit(`like:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.'},
      { status: 429 }
    )
  }

  const { post_id, like_token } = await req.json()

  if (!post_id || !like_token) {
    return NextResponse.json({ error: 'post_id and like_token are required' }, { status: 400 })
  }

  // Check if already liked
  const { data: existing } = await supabaseAdmin
    .from('likes')
    .select('id')
    .eq('post_id', post_id)
    .eq('like_token', like_token)
    .single()

  if (existing) {
    // Unlike
    await supabaseAdmin.from('likes').delete().eq('id', existing.id)
    const { count } = await supabaseAdmin
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post_id)
    return NextResponse.json({ liked: false, count: count ?? 0 })
  }

  // Like
  await supabaseAdmin.from('likes').insert({ post_id, like_token })
  const { count } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
  return NextResponse.json({ liked: true, count: count ?? 0 })
}
