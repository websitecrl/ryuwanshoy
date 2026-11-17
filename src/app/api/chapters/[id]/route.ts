import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteManyFromR2 } from '@/lib/r2'
import type { TablesUpdate } from '@/types/database'

type ChapterUpdate = TablesUpdate<'chapters'>

// admin: chapter + pages
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

// admin: update chapter
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

    // publish -> never still a draft (readers need is_published = true AND is_draft = false)
    if (body.is_published === true) payload.is_draft = false

    const { data, error } = await supabaseAdmin
      .from('chapters')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // unique (series_id, chapter_number) -> 409 Conflict, same as POST /api/chapters
      if (error.code === '23505') {
        return NextResponse.json(
          { data: null, error: 'A chapter with this number already exists in this series' },
          { status: 409 }
        )
      }
      throw error
    }

    revalidatePublicContent('PATCH /api/chapters/[id]')
    return NextResponse.json({ data, error: null })
  } catch (error) {
    console.error('PATCH /api/chapters/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to update chapter' },
      { status: 500 }
    )
  }
}

// admin: delete chapter -> pages cascade -> R2 images removed
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

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

    const { error } = await supabaseAdmin
      .from('chapters')
      .delete()
      .eq('id', id)

    if (error) throw error
    revalidatePublicContent('DELETE /api/chapters/[id]')

    // DB delete ok -> awaited, batched R2 cleanup (Workers drop pending promises)
    const pages = (chapter as { pages: Array<{ image_url: string }> }).pages ?? []
    const imageRefs = pages.map(p => p.image_url).filter(Boolean)
    if (imageRefs.length) {
      const { failed } = await deleteManyFromR2(imageRefs)
      if (failed.length) {
        console.error(`DELETE /api/chapters/${id}: ${failed.length} R2 object(s) not deleted:`, failed)
      }
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