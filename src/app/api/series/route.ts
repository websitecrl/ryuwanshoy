import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'
import type { TablesInsert } from '@/types/database'

type SeriesInsert = TablesInsert<'series'>

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('series')
      .select('*, chapters(count)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapped = (data ?? []).map(s => ({
      ...s,
      chapter_count: (s.chapters as unknown as [{ count: number }])?.[0]?.count ?? 0
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/series error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    if (!body.title || !body.slug) {
      return NextResponse.json(
        { error: 'title and slug are required' },
        { status: 400 }
      )
    }

    const payload: SeriesInsert = {
      title:        body.title.trim(),
      slug:         body.slug.trim().toLowerCase(),
      description:  body.description?.trim() || null,
      cover_image:  null,
      banner_image: null,
      genre:        body.genre  || null,
      status:       body.status || 'ongoing',
      is_published: body.is_published ?? false,
      min_age:      body.min_age ?? 0,
    }

    if (body.coverImageBase64) {
      try {
        if (body.coverImageBase64.length > 34_000_000) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 })
        }

        // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
        // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
        // currently broken on this deployment. See src/lib/image-processing.ts.
        payload.cover_image = await uploadToR2(
          body.coverImageBase64,
          'covers',
          `cover-${payload.slug}`
        )
      } catch (err) {
        console.error('POST /api/series cover upload error:', err)
        return NextResponse.json(
          { error: 'Cover image upload failed' },
          { status: 500 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('series')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A series with this slug already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/series error:', error)
    return NextResponse.json(
      { error: 'Failed to create series' },
      { status: 500 }
    )
  }
}