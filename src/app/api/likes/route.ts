import 'server-only'
import { supabaseAdmin } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from "@/lib/rate-limit-cf"

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
  // Max 20 likes or unlikes per IP per 60 seconds (LIKE_LIMITER in wrangler.jsonc)
  const limited = await rateLimit(req, 'LIKE_LIMITER')
  if (limited) return limited

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
  const { error: insertError } = await supabaseAdmin
    .from('likes')
    //upsert - insert , but if therss a conflict do something else instead of failing 
    .upsert({ post_id, like_token }, { onConflict: 'post_id,like_token', ignoreDuplicates:true })

   if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
   }

   const { count } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)
    return NextResponse.json({ liked: true, count: count ?? 0 })
}
