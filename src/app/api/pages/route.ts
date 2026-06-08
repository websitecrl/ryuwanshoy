import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'
import sharp from 'sharp'

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
    if (body.page_number === undefined || typeof body.page_number !== 'number') {
      return NextResponse.json(
        { data: null, error: 'page_number is required' },
        { status: 400 }
      )
    }

    let imageUrl: string
    try {
      // Decode → resize with sharp → re-encode as WebP → upload
      const commaIdx   = body.imageBase64.indexOf(',')
      const rawBuffer  = Buffer.from(body.imageBase64.slice(commaIdx + 1), 'base64')

      // Spreads: max 2400px wide (preserves panorama quality)
      // Singles: max 1200px wide (standard portrait page)
      const maxWidth   = body.is_spread ? 2400 : 1200
      const processed  = await sharp(rawBuffer)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()

      const processedBase64 = `data:image/webp;base64,${processed.toString('base64')}`

      imageUrl = await uploadToR2(
        processedBase64,
        'pages',
        `chapter-${body.chapter_id}-page-${body.page_number}`
      )
    } catch {
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
        page_number: body.page_number,
        is_spread:   body.is_spread ?? false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/pages error:', error)
    return NextResponse.json(
      { data: null, error: 'Failed to upload page' },
      { status: 500 }
    )
  }
}