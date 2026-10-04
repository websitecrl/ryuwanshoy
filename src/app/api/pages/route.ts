import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { deleteFromR2, InvalidImageError, uploadToR2 } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    // Spreads are ~2× the size of a single page before processing
    const MAX_SIZE = body.is_spread ? 100_000_000 : 34_000_000
    if (body.imageBase64 && body.imageBase64.length > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max is ${body.is_spread ? '75MB' : '25MB'}.` },
        { status: 413 }
      )
    }
    if (!body.chapter_id || typeof body.chapter_id !== 'string') {
      return NextResponse.json(
        { data: null, error: 'chapter_id is required' },
        { status: 400 }
      )
    }
    if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
      return NextResponse.json(
        { data: null, error: 'imageBase64 is required' },
        { status: 400 }
      )
    }
    // Check the chapter before uploading so a bad id doesn't leave an
    // orphaned object in R2.
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('id', body.chapter_id)
      .maybeSingle()

    if (chapterError) throw chapterError
    if (!chapter) {
      return NextResponse.json(
        { data: null, error: 'Chapter not found' },
        { status: 404 }
      )
    }

    // page_number is assigned here (append = max + 1), never taken from the
    // client — a client-computed number goes stale after a delete/reorder.
    // Callers upload sequentially, so this preserves their intended order.
    const { data: last, error: lastError } = await supabaseAdmin
      .from('pages')
      .select('page_number')
      .eq('chapter_id', body.chapter_id)
      .order('page_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastError) throw lastError
    const pageNumber = (last?.page_number ?? 0) + 1

    let imageUrl: string
    try {
      // TEMPORARY STOPGAP: skip resize/webp conversion entirely and upload
      // the original file as-is. Both the Cloudflare Images binding (platform
      // bug, ticket open) and @cf-wasm/photon (webpack/wasm bundling issue,
      // in progress) are currently broken on this Workers deployment.
      // Revisit once either is resolved — see src/lib/image-processing.ts
      // for full history of what's been tried.
      //
      // No filename → uploadToR2 generates a UUID key. The old
      // `chapter-{id}-page-{n}` key was tied to position, so after a delete
      // renumbered the chapter, the next upload overwrote another page's image.
      imageUrl = await uploadToR2(body.imageBase64, 'pages')
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return NextResponse.json({ data: null, error: err.message }, { status: 400 })
      }
      console.error('POST /api/pages upload error:', err)
      return NextResponse.json(
        { data: null, error: 'Image upload failed' },
        { status: 500 }
      )
    }
    const { data, error } = await supabaseAdmin
      .from('pages')
      .insert({
        chapter_id:  body.chapter_id,
        image_url:   imageUrl,
        page_number: pageNumber,
        is_spread:   body.is_spread ?? false,
      })
      .select()
      .single()

    if (error) {
      // UUID keys are never reused, so an object without a row would sit in
      // the bucket forever — remove it before reporting the failure.
      try {
        await deleteFromR2(imageUrl)
      } catch (cleanupErr) {
        console.error('POST /api/pages orphan cleanup failed for:', imageUrl, cleanupErr)
      }
      throw error
    }

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/pages error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to upload page' },
      { status: 500 }
    )
  }
}