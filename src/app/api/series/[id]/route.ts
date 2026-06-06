import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import type { Tables, TablesUpdate } from '@/types/database'

type Series = Tables<'series'>
type Chapter = Tables<'chapters'> & { pages: Array<{ image_url: string }> }
type SeriesUpdate = TablesUpdate<'series'>

interface SeriesWithChapters extends Series {
  chapters: Chapter[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    const { data, error } = await supabaseAdmin
      .from('series')
      .select(`
        *,
        chapters (
          id, series_id, title, chapter_number,
          is_early_access, published_at, created_at
        )
      `)
      .eq(isUUID ? 'id' : 'slug', id)
      .order('chapter_number', { referencedTable: 'chapters', ascending: true })
      .single()

    if (error || !data) {
      return NextResponse.json(
        { data: null, error: 'Series not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data, error: null })
  } catch (error) {
    console.error('GET /api/series/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to fetch series' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const body = await request.json()

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('series')
      .select('slug, cover_image, banner_image')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { data: null, error: 'Series not found' },
        { status: 404 }
      )
    }

    const payload: SeriesUpdate = {}
    if (body.title !== undefined)        payload.title        = body.title.trim()
    if (body.slug !== undefined)         payload.slug         = body.slug.trim().toLowerCase()
    if (body.description !== undefined)  payload.description  = body.description?.trim() ?? null
    if (body.genre !== undefined)        payload.genre        = body.genre?.trim() ?? null
    if (body.status !== undefined)       payload.status       = body.status
    if (body.is_published !== undefined) payload.is_published = body.is_published

    if (body.coverImageBase64) {
      try {
        if (existing.cover_image) {
          deleteFromR2(existing.cover_image).catch(err =>
            console.error('R2 cover cleanup failed:', err)
          )
        }
        payload.cover_image = await uploadToR2(
          body.coverImageBase64,
          'covers',
          `cover-${existing.slug}`
        )
      } catch {
        return NextResponse.json(
          { data: null, error: 'Cover image upload failed' },
          { status: 500 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('series')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { data: null, error: 'A series with this slug already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ data, error: null })
  } catch (error) {
    console.error(`PATCH /api/series/${id} error:`, error)
    return NextResponse.json(
      { data: null, error: 'Failed to update series' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('series')
      .select(`cover_image, banner_image, chapters (pages (image_url))`)
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { data: null, error: 'Series not found' },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from('series')
      .delete()
      .eq('id', id)

    if (error) throw error

    if (existing.cover_image) deleteFromR2(existing.cover_image).catch(console.error)
    if (existing.banner_image) deleteFromR2(existing.banner_image).catch(console.error)

    const chapters = (existing as SeriesWithChapters).chapters ?? []
    for (const chapter of chapters) {
      for (const page of chapter.pages ?? []) {
        if (page.image_url) deleteFromR2(page.image_url).catch(console.error)
      }
    }

    return NextResponse.json({ data: null, error: null })
  } catch (error) {
    console.error('DELETE /api/series/[id] error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to delete series' },
      { status: 500 }
    )
  }
}