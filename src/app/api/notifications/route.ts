import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { data: comments } = await supabaseAdmin
      .from('comments')
      .select(`
        id, name, content, is_read, created_at,
        post_id, chapter_id,
        post:post_id ( title ),
        chapter:chapter_id ( chapter_number, series:series_id ( title ) )
      `)
      .order('created_at', { ascending: false })
      .limit(15)

    const { data: likes } = await supabaseAdmin
      .from('likes')
      .select(`
        id, created_at, post_id,
        post:post_id ( title )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    const commentNotifs = (comments ?? []).map(c => {
      const post    = c.post    as { title: string } | null
      const chapter = c.chapter as { chapter_number: number; series: { title: string } | null } | null
      return {
        id:             c.id,
        type:           'comment' as const,
        name:           c.name,
        content:        c.content,
        is_read:        c.is_read,
        created_at:     c.created_at,
        post_id:        c.post_id,
        chapter_id:     c.chapter_id,
        post_title:     post?.title ?? null,
        chapter_number: chapter?.chapter_number ?? null,
        series_title:   chapter?.series?.title ?? null,
      }
    })

    const likeNotifs = (likes ?? []).map(l => {
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

    return NextResponse.json({ notifications: all })
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    return NextResponse.json({ notifications: [] })
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