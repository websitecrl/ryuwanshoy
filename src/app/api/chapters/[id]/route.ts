import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { deleteFromR2 } from '@/lib/r2'
import type { TablesUpdate } from '@/types/database'

type ChapterUpdate = TablesUpdate<'chapters'>

// ─── GET /api/chapters/[id] ───────────────────────────────────────────────────
// Admin only — returns chapter with pages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('chapters')
      .select('*, pages(*), series(is_published)')
      .eq('id', id)
      .order('page_number', { referencedTable: 'pages', ascending: true })
      .single()

    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch (error) {
    console.error('GET /api/chapters/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to fetch chapter' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/chapters/[id] ─────────────────────────────────────────────────
// Admin only — update chapter metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await req.json()

    const payload: ChapterUpdate = {}
    if (body.chapter_number  !== undefined) payload.chapter_number  = body.chapter_number
    if (body.title           !== undefined) payload.title           = body.title?.trim() || null
    if (body.is_early_access !== undefined) payload.is_early_access = body.is_early_access
    if (body.is_published    !== undefined) payload.is_published    = body.is_published
    if (body.published_at    !== undefined) payload.published_at    = body.published_at

    const { data, error } = await supabaseAdmin
      .from('chapters')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { data: null, error: 'A chapter with this number already exists in this series' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ data, error: null })
  } catch (error) {
    console.error('PATCH /api/chapters/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to update chapter' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/chapters/[id] ────────────────────────────────────────────────
// Admin only — deletes chapter + cleans up all page images from R2
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // Fetch pages first so we can clean up R2 after deletion
    const { data: chapter, error: fetchError } = await supabaseAdmin
      .from('chapters')
      .select('pages (image_url)')
      .eq('id', id)
      .single()

    if (fetchError || !chapter) {
      return NextResponse.json(
        { data: null, error: 'Chapter not found' },
        { status: 404 }
      )
    }

    // Delete from DB — pages cascade automatically via FK
    const { error } = await supabaseAdmin
      .from('chapters')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Clean up R2 after DB delete succeeds — fire and forget
    const pages = (chapter as { pages: Array<{ image_url: string }> }).pages ?? []
    for (const page of pages) {
      if (page.image_url) deleteFromR2(page.image_url).catch(console.error)
    }

    return NextResponse.json({ data: null, error: null })
  } catch (error) {
    console.error('DELETE /api/chapters/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to delete chapter' },
      { status: 500 }
    )
  }
}