import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteFromR2 } from '@/lib/r2'

/**
 * admin: delete one page, then close the gap it leaves in the page numbers.
 *
 * The renumber is one rpc -> renumber_pages() with an empty list, which keeps
 * the remaining pages in their order and numbers them 1..N in a single
 * transaction (1 subrequest for any chapter size).
 *
 * 404 -> no such page.
 * 500 with "Page deleted, but ..." -> the page is gone but the renumber
 *        failed; any later reorder renumbers the chapter and repairs it.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // 1. page -> 2. R2 image -> 3. row -> 4. renumber (one rpc)
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

    try {
      await deleteFromR2(page.image_url)
    } catch {
      console.error('R2 delete failed for:', page.image_url)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('pages')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    // the page is gone -> purge, even if the renumber below fails
    revalidatePublicContent('DELETE /api/pages/[id]')

    if (!page.chapter_id) {
      return NextResponse.json({ data: null, error: null })
    }

    // empty list -> the remaining pages keep their order and become 1..N
    const { error: renumberError } = await supabaseAdmin.rpc('renumber_pages', {
      p_chapter_id: page.chapter_id,
      p_page_ids:   [],
    })

    // Supabase returns errors (no throw); the page is already deleted
    if (renumberError) {
      console.error('DELETE /api/pages/[id]: renumber failed:', renumberError)
      return NextResponse.json(
        { data: null, error: 'Page deleted, but the other pages could not be renumbered. Reload, then drag any page to fix the order.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: null, error: null })
  } catch (error) {
    console.error('DELETE /api/pages/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}