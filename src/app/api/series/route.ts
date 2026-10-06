import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteManyFromR2, InvalidImageError } from '@/lib/r2'
import type { TablesInsert } from '@/types/database'

type SeriesInsert = TablesInsert<'series'>

export async function GET() {
  try {
    const auth = await requireAdmin()
    const isAdmin = !(auth instanceof NextResponse)

    let query = supabaseAdmin
      .from('series')
      .select('*, chapters(count)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    // Public chapter_count only counts chapters readers can open (same rule
    // as the reader pages). The admin lists use this route too and need
    // every chapter counted.
    if (!isAdmin) {
      query = query
        .eq('chapters.is_published', true)
        .eq('chapters.is_draft', false)
    }

    const { data, error } = await query

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
      min_age:      body.min_age ?? 13,
    }

    if (body.coverImageBase64) {
      try {
        if (body.coverImageBase64.length > 34_000_000) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 })
        }

        // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
        // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
        // currently broken on this deployment. See src/lib/image-processing.ts.
        payload.cover_image = await uploadToR2(body.coverImageBase64, 'covers')
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
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

    if (error && payload.cover_image) {
      // The row was never created, so nothing references the new cover.
      const { failed } = await deleteManyFromR2([payload.cover_image])
      if (failed.length) console.error('POST /api/series: orphaned cover not deleted:', failed)
    }

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