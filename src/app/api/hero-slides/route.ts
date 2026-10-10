import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteManyFromR2, InvalidImageError, uploadToR2 } from '@/lib/r2'
import { serverError } from '@/lib/api-errors'

// ─── GET — admin only (every slide, hidden ones included) ─────────────────────
// Readers get hero slides from the cached home page (src/app/page.tsx), so
// there is no public GET anymore. The old public branch was only used by the
// home page's realtime refetch, which was removed.
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('hero_slides')
    .select(`
      id, headline, banner_image, is_visible,
      order_index, series_id, chapter_id,
      series ( title, slug, min_age, is_published ),
      chapter:chapter_id ( id, chapter_number, is_published, is_draft )
    `)
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('POST /api/hero-slides')

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // The image comes in with the slide (not via a separate upload call) so
  // that if the insert fails, this handler can delete the file it just
  // uploaded. A separate upload left the file in R2 with no row pointing at it.
  let bannerImage: string | null = null
  if (body.bannerImageBase64 !== undefined && body.bannerImageBase64 !== null) {
    if (typeof body.bannerImageBase64 !== 'string' || !body.bannerImageBase64) {
      return NextResponse.json({ error: 'bannerImageBase64 must be an image data URI' }, { status: 400 })
    }
    if (body.bannerImageBase64.length > 34_000_000) { // ~25MB decoded
      return NextResponse.json({ error: 'Image size exceeds the limit of 25MB' }, { status: 413 })
    }
    try {
      bannerImage = await uploadToR2(body.bannerImageBase64, 'hero-banners')
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      console.error('POST /api/hero-slides upload error:', err)
      return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('hero_slides')
    .insert({
      series_id:    body.series_id    ?? null,
      chapter_id:   body.chapter_id   ?? null,
      banner_image: bannerImage,
      headline:     body.headline     ?? null,
      is_visible:   body.is_visible   ?? false,
      order_index:  body.order_index,
    })
    .select()
    .single()

  if (error) {
    // Awaited: Workers can cut off promises still pending after the response.
    if (bannerImage) {
      const { failed } = await deleteManyFromR2([bannerImage])
      if (failed.length) console.error('POST /api/hero-slides: orphan not deleted:', failed)
    }
    return serverError('POST /api/hero-slides', error, 'Failed to create slide.')
  }

  return NextResponse.json(data, { status: 201 })
}