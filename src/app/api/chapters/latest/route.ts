import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_LIMIT = 6
const MAX_LIMIT = 50

// ─── GET /api/chapters/latest ─────────────────────────────────────────────────
// Public — latest published, non-draft chapters from published series.
// Same fields as the home page's server query.
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get('limit'))
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      id,
      title,
      chapter_number,
      is_early_access,
      published_at,
      is_published,
      series:series_id!inner (
        title,
        slug,
        cover_image,
        min_age,
        is_published
      )
    `)
    .eq('is_published', true)
    .eq('is_draft', false)
    .eq('series.is_published', true)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('GET /api/chapters/latest error:', error)
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
