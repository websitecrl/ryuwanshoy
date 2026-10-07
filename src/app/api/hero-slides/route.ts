import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'

// ─── GET — public gets visible only, admin gets all ───────────────────────────
export async function GET() {
  const auth = await requireAdmin()
  const isAdmin = !(auth instanceof NextResponse)

  const query = supabaseAdmin
    .from('hero_slides')
    .select(`
      id, headline, banner_image, is_visible,
      order_index, series_id, chapter_id,
      series ( title, slug, min_age, is_published ),
      chapter:chapter_id ( id, chapter_number, is_published, is_draft )
    `)
    .order('order_index', { ascending: true })

  if (!isAdmin) {
    query.eq('is_visible', true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (isAdmin) return NextResponse.json(data)

  // The service-role client bypasses RLS, so apply the same visibility the
  // anon client gets: unpublished series and unpublished/draft chapters are
  // nulled out, matching the home page's server-rendered hero query.
  const visible = (data ?? []).map(({ series, chapter, ...slide }) => ({
    ...slide,
    series: series?.is_published
      ? { title: series.title, slug: series.slug, min_age: series.min_age }
      : null,
    chapter: chapter?.is_published && chapter.is_draft === false
      ? { id: chapter.id, chapter_number: chapter.chapter_number }
      : null,
  }))

  return NextResponse.json(visible)
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