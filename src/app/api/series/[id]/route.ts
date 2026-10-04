import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteManyFromR2, InvalidImageError } from '@/lib/r2'
import type { Tables, TablesUpdate } from '@/types/database'

type Series = Tables<'series'>
type Chapter = Tables<'chapters'> & { pages: Array<{ image_url: string }> }
type SeriesUpdate = TablesUpdate<'series'>

interface SeriesWithChapters extends Series {
  chapters: Chapter[]
}

/**
 * Covers used to be keyed cover-{slug} (and cover-undefined whenever PATCH
 * ran without a slug), so one legacy file can still back several series.
 * True if any series other than `seriesId` points at the same object. A
 * failed check counts as shared: orphaning a file beats breaking a live cover.
 */
async function isCoverShared(coverUrl: string, seriesId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('series')
    .select('id', { count: 'exact', head: true })
    .like('cover_image', `${coverUrl.split('?')[0]}%`)
    .neq('id', seriesId)
  return !!error || (count ?? 0) > 0
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    const auth = await requireAdmin()
    const isAdmin = !(auth instanceof NextResponse)

    const chaptersSelect = `
      id, series_id, title, chapter_number,
      is_early_access, published_at, created_at, is_published, is_draft
    `

    const query = supabaseAdmin
      .from('series')
      .select(`*, chapters (${chaptersSelect})`)
      .eq(isUUID ? 'id' : 'slug', id)
      .order('chapter_number', { referencedTable: 'chapters', ascending: true })

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

    // Same visibility rule as the public reader pages.
    if (!isAdmin) {
      data.chapters = (data.chapters ?? []).filter(
        c => c.is_published === true && c.is_draft === false
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
    if (body.min_age !== undefined)      payload.min_age      = body.min_age

    if (body.coverImageBase64) {
        try {
          if (body.coverImageBase64.length > 34_000_000) {
            return NextResponse.json({ error: 'Image too large'}, { status: 413 })
          }

          // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
          // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
          // currently broken on this deployment. See src/lib/image-processing.ts.
          payload.cover_image = await uploadToR2(body.coverImageBase64, 'covers')
        } catch (err) {
          if (err instanceof InvalidImageError) {
            return NextResponse.json({ data: null, error: err.message }, { status: 400 })
          }
          console.error(`PATCH /api/series/${id} cover upload error:`, err)
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

    // A new cover replaces the old file once the row points at it; if the
    // update failed, the new upload is the unreferenced one instead.
    if (payload.cover_image) {
      const orphan = error ? payload.cover_image : existing.cover_image
      if (orphan && (error || !(await isCoverShared(orphan, id)))) {
        const { failed } = await deleteManyFromR2([orphan])
        if (failed.length) console.error(`PATCH /api/series/${id}: old cover not deleted:`, failed)
      }
    }

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

    // Awaited, not fire-and-forget: Workers can cut off promises still
    // pending after the response is sent, orphaning the files. One batched
    // request also stays under the per-request subrequest cap.
    const chapters = (existing as SeriesWithChapters).chapters ?? []
    const cover = existing.cover_image && !(await isCoverShared(existing.cover_image, id))
      ? existing.cover_image
      : null
    const imageRefs = [
      cover,
      existing.banner_image,
      ...chapters.flatMap(c => (c.pages ?? []).map(p => p.image_url)),
    ].filter((ref): ref is string => !!ref)

    if (imageRefs.length) {
      const { failed } = await deleteManyFromR2(imageRefs)
      if (failed.length) {
        console.error(`DELETE /api/series/${id}: ${failed.length} R2 object(s) not deleted:`, failed)
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