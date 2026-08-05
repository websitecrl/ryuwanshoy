import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

// ─── GET /api/chapters ────────────────────────────────────────────────────────
// Admin only — get all chapters for a series
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const series_id = req.nextUrl.searchParams.get('series_id')

  if (!series_id) {
    return NextResponse.json(
      { error: 'series_id is required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('chapters')
    .select('*')
    .eq('series_id', series_id)
    .order('chapter_number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// ─── POST /api/chapters ───────────────────────────────────────────────────────
// Admin only — create a new chapter
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { series_id, chapter_number, title, is_early_access, published_at, is_published, is_draft } = body

  if (!series_id || chapter_number === undefined) {
    return NextResponse.json(
      { error: 'series_id and chapter_number are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('chapters')
    .insert({
      series_id,
      chapter_number,
      title:           title || null,
      is_early_access: is_early_access ?? false,
      published_at:    published_at || null,
      is_published:    is_published ?? false,
      is_draft:        is_draft ?? false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Chapter number already exists for this series' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}