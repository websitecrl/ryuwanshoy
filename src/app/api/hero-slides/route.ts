import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

// ─── GET — public gets visible only, admin gets all ───────────────────────────
export async function GET() {
  const auth = await requireAdmin()
  const isAdmin = !(auth instanceof NextResponse)

  const query = supabaseAdmin
    .from('hero_slides')
    .select(`
      id, headline, banner_image, is_visible,
      order_index, series_id, chapter_id,
      series ( title, slug )
    `)
    .order('order_index', { ascending: true })

  if (!isAdmin) {
    query.eq('is_visible', true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('hero_slides')
    .insert({
      series_id:    body.series_id    ?? null,
      chapter_id:   body.chapter_id   ?? null,
      banner_image: body.banner_image ?? null,
      headline:     body.headline     ?? null,
      is_visible:   body.is_visible   ?? false,
      order_index:  body.order_index,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}