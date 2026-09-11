import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

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
      // TEMPORARY STOPGAP: skip resize/webp conversion entirely and upload
      // the original file as-is. Both the Cloudflare Images binding (platform
      // bug, ticket open) and @cf-wasm/photon (webpack/wasm bundling issue,
      // in progress) are currently broken on this Workers deployment.
      // Revisit once either is resolved — see src/lib/image-processing.ts
      // for full history of what's been tried.
      imageUrl = await uploadToR2(
        body.imageBase64,
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