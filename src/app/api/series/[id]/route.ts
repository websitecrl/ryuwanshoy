import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import {
  cachedPublicQuery,
  nullIfNotFound,
  PublicNotFoundError,
  revalidatePublicContent,
} from '@/lib/cache/public-cache'
import { createPublicClient } from '@/lib/supabase/public'
import { filterUnsharedCovers } from '@/lib/series-covers'
import { isUuid } from '@/lib/validation'
import { uploadToR2, deleteManyFromR2, InvalidImageError } from '@/lib/r2'
import type { Tables, TablesUpdate } from '@/types/database'

type Series = Tables<'series'>
type Chapter = Tables<'chapters'> & { pages: Array<{ image_url: string }> }
type SeriesUpdate = TablesUpdate<'series'>

interface SeriesWithChapters extends Series {
  chapters: Chapter[]
}

const CHAPTERS_SELECT = `
  id, series_id, title, chapter_number,
  is_early_access, published_at, created_at, is_published, is_draft
`

/**
 * The reader's view of one series, cached across requests and visitors.
 * Readers call this route from the home page "Continue reading" bar on every
 * visit, so it must not hit Supabase each time.
 *
 * Anon client + is_published filter, and only published, non-draft chapters
 * (same visibility rule as the reader pages). A missing series throws
 * PublicNotFoundError so bots probing random slugs don't fill the cache; a
 * Supabase error throws so it is never cached either.
 *
 * @param key - a series uuid or slug, as given in the URL
 */
const queryPublicSeries = cachedPublicQuery('api:series', async (key: string) => {
  const { data, error } = await createPublicClient()
    .from('series')
    .select(`*, chapters (${CHAPTERS_SELECT})`)
    .eq(isUuid(key) ? 'id' : 'slug', key)
    .eq('is_published', true)
    .order('chapter_number', { referencedTable: 'chapters', ascending: true })
    .maybeSingle()

  if (error) throw error
  if (!data) throw new PublicNotFoundError(`series "${key}"`)

  return {
    ...data,
    chapters: (data.chapters ?? []).filter(
      c => c.is_published === true && c.is_draft === false
    ),
  }
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // No cookie → no Supabase call here, so this is cheap for readers.
    const auth = await requireAdmin()
    const isAdmin = !(auth instanceof NextResponse)

    // Admin (editor pages, wizard slug check): live data, any series,
    // drafts included. Never cached.
    let data: SeriesWithChapters | null
    if (isAdmin) {
      const res = await supabaseAdmin
        .from('series')
        .select(`*, chapters (${CHAPTERS_SELECT})`)
        .eq(isUuid(id) ? 'id' : 'slug', id)
        .order('chapter_number', { referencedTable: 'chapters', ascending: true })
        .maybeSingle()
      if (res.error) throw res.error
      data = res.data as SeriesWithChapters | null
    } else {
      data = await nullIfNotFound(queryPublicSeries(id)) as SeriesWithChapters | null
    }

    // A real "not found" is a 404; a failure is a 500, so it never looks like
    // "deleted" (callers prune local bookmarks on a 404).
    if (!data) {
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
  revalidatePublicContent('PATCH /api/series/[id]')

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
    // A legacy old cover may still back other series (see series-covers.ts).
    if (payload.cover_image) {
      const orphans = error
        ? [payload.cover_image]
        : existing.cover_image ? await filterUnsharedCovers([existing.cover_image], id) : []
      if (orphans.length) {
        const { failed } = await deleteManyFromR2(orphans)
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
  revalidatePublicContent('DELETE /api/series/[id]')

  const { id } = await params

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('series')
      // hero_slides: deleting the series cascades to its slides in the DB,
      // so their banner images must be collected here or they'd stay in R2.
      .select(`cover_image, banner_image, chapters (pages (image_url)), hero_slides (banner_image)`)
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
    const chapters = existing.chapters ?? []
    const covers = existing.cover_image ? await filterUnsharedCovers([existing.cover_image]) : []
    const imageRefs = [
      ...covers,
      existing.banner_image,
      ...chapters.flatMap(c => (c.pages ?? []).map(p => p.image_url)),
      ...(existing.hero_slides ?? []).map(h => h.banner_image),
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