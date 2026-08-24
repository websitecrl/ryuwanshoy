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

    // Check if request is from admin
    const auth = await requireAdmin()
    const isAdmin = !(auth instanceof NextResponse)

    const chaptersSelect = `
      id, series_id, title, chapter_number,
      is_early_access, published_at, created_at, is_published
    `

    const query = supabaseAdmin
      .from('series')
      .select(`*, chapters (${chaptersSelect})`)
      .eq(isUUID ? 'id' : 'slug', id)
      .order('chapter_number', { referencedTable: 'chapters', ascending: true })

    // Public callers only see published series + published chapters
    if (!isAdmin) {
      query.eq('is_published', true)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      return NextResponse.json(
        { data: null, error: 'Series not found' },
        { status: 404 }
      )
    }

    // Filter chapters for public callers
    if (!isAdmin) {
      data.chapters = (data.chapters ?? []).filter(c => c.is_published === true)
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
    if (body.min_age !== undefined)      payload.min_age      = body.min_age

    if (body.coverImageBase64) {
        try {
           if (body.coverImageBase64.length > 34_000_000) {
              return NextResponse.json({ error: 'Image too large'}, { status: 413 })
            }
            
          const sharp = (await import('sharp')).default
          const commaIdx  = body.coverImageBase64.indexOf(',')
          const buffer    = Buffer.from(body.coverImageBase64.slice(commaIdx + 1), 'base64')
          const processed = await sharp(buffer)
            .resize(920, null, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer()
          const webpBase64 = `data:image/webp;base64,${processed.toString('base64')}`

          payload.cover_image = await uploadToR2(
            webpBase64,
            'covers',
            `cover-${payload.slug}`
          )
        } catch {
          return NextResponse.json(
            { error: 'Cover image upload failed' },
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