import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { deleteFromR2 } from '@/lib/r2'

// ─── DELETE — admin only ──────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // Step 1 — fetch the page
    const { data: page, error: fetchError } = await supabaseAdmin
      .from('pages')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !page) {
      return NextResponse.json(
        { data: null, error: 'Page not found' },
        { status: 404 }
      )
    }

    // Step 2 — delete image from R2
    try {
      await deleteFromR2(page.image_url)
    } catch {
      console.error('R2 delete failed for:', page.image_url)
    }

    // Step 3 — delete the page record from DB
    const { error: deleteError } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Step 4 — renumber remaining pages in this chapter
    if (!page.chapter_id) {
      return NextResponse.json({ data: null, error: null })
    }

    const { data: remaining, error: remainingError } = await supabaseAdmin
      .from('pages')
      .select('id')
      .eq('chapter_id', page.chapter_id)
      .order('page_number', { ascending: true })

    if (remainingError) throw remainingError

    await Promise.all(
      remaining.map((p, index) =>
        supabaseAdmin
          .from('pages')
          .update({ page_number: index + 1 })
          .eq('id', p.id)
      )
    )

    return NextResponse.json({ data: null, error: null })
  } catch (error) {
    console.error('DELETE /api/pages/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}