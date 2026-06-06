import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── GET /api/drafts ──────────────────────────────────────────────────────────
// Admin only — returns count of unpublished series and chapters
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const [{ count: seriesCount }, { count: chaptersCount }] = await Promise.all([
      supabaseAdmin
        .from('series')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', false),
      supabaseAdmin
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', false)
    ])

    const count = (seriesCount ?? 0) + (chaptersCount ?? 0)

    return NextResponse.json({ count })
  } catch (err) {
    console.error('GET /api/drafts error:', err )
    return NextResponse.json({ count: 0 })
  }
}

// ─── DELETE /api/drafts ───────────────────────────────────────────────────────
// Admin only — deletes all unpublished series and chapters
export async function DELETE() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { error: seriesError } = await supabaseAdmin
      .from('series')
      .delete()
      .eq('is_published', false)

    if (seriesError) throw seriesError

    const { error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .delete()
      .eq('is_published', false)

    if (chaptersError) throw chaptersError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/drafts error:', err)
    return NextResponse.json(
      { error: 'Failed to delete drafts' },
      { status: 500 }
    )
  }
}