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

    const MAX_SIZE = 34_000_000
    if (body.imageBase64 && body.imageBase64.length > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
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