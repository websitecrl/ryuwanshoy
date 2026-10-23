import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteFromR2 } from '@/lib/r2'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('DELETE /api/pages/[id]')

  try {
    const { id } = await params

    // 1. page -> 2. R2 image -> 3. row -> 4. renumber
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

    if (!page.chapter_id) {
      return NextResponse.json({ data: null, error: null })
    }

    const { data: remaining, error: remainingError } = await supabaseAdmin
      .from('pages')
      .select('id')
      .eq('chapter_id', page.chapter_id)
      .order('page_number', { ascending: true })

    if (remainingError) throw remainingError

    const results = await Promise.all(
      remaining.map((p, index) =>
        supabaseAdmin
          .from('pages')
          .update({ page_number: index + 1 })
          .eq('id', p.id)
      )
    )

    // Supabase returns errors (no throw); the page is already deleted
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`DELETE /api/pages/[id]: ${failed.length} of ${results.length} renumber updates failed:`, failed[0]?.error)
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