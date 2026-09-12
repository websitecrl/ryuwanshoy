import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

// ─── GET /api/chapters/all ────────────────────────────────────────────────────
// Admin only — returns all chapters including unpublished (used by hero slide manager)
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { data, error } = await supabaseAdmin
      .from('chapters')
      .select('*, series:series_id(title)')
      .order('chapter_number', { ascending: true })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('GET /api/chapters/all error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    )
  }
}