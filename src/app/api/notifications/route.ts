import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

// GET: admin bell feed.
// { notifications: (comment | like)[] newest first, feedbackUnread: number }
// Comments live on a series or a post (chapters have none), so the label
// target is the series title or the post title.
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const [commentsRes, likesRes, feedbackRes] = await Promise.all([
      supabaseAdmin
        .from('comments')
        .select(`
          id, name, content, is_read, created_at, post_id, series_id,
          post:post_id ( title ),
          series:series_id ( title )
        `)
        .order('created_at', { ascending: false })
        .limit(15),
      supabaseAdmin
        .from('likes')
        .select(`
          id, created_at, post_id,
          post:post_id ( title )
        `)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ])

    for (const res of [commentsRes, likesRes, feedbackRes]) {
      if (res.error) console.error('GET /api/notifications query error:', res.error)
    }

    const commentNotifs = (commentsRes.data ?? []).map(c => {
      const post   = c.post   as { title: string } | null
      const series = c.series as { title: string } | null
      return {
        id:           c.id,
        type:         'comment' as const,
        name:         c.name,
        content:      c.content,
        is_read:      c.is_read,
        created_at:   c.created_at,
        post_id:      c.post_id,
        post_title:   post?.title ?? null,
        series_title: series?.title ?? null,
      }
    })

    const likeNotifs = (likesRes.data ?? []).map(l => {
      const post = l.post as { title: string } | null
      return {
        id:         l.id,
        type:       'like' as const,
        is_read:    false,
        created_at: l.created_at,
        post_id:    l.post_id,
        post_title: post?.title ?? null,
      }
    })

    const all = [...commentNotifs, ...likeNotifs].sort(
      (a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()
    )

    return NextResponse.json({ notifications: all, feedbackUnread: feedbackRes.count ?? 0 })
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    return NextResponse.json({ notifications: [], feedbackUnread: 0 })
  }
}

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { error } = await supabaseAdmin
    .from('comments')
    .update({ is_read: true })
    .or('is_read.eq.false,is_read.is.null')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}