import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteFromR2, InvalidImageError, uploadToR2 } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('POST /api/pages')

  try {
    const body = await req.json()

    // spreads ~2x a single page
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
    // chapter check first -> no orphaned upload
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

    // page_number = max + 1 here, never from the client
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
      // uploaded as sent, fresh UUID key
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
      // insert failed -> remove the upload
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