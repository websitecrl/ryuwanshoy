import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

// ─── GET — admin only ─────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const [series, chapters, posts, earlyAccess] = await Promise.all([
    supabaseAdmin.from('series').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('chapters').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('early_access').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    series:      series.count      ?? 0,
    chapters:    chapters.count    ?? 0,
    posts:       posts.count       ?? 0,
    earlyAccess: earlyAccess.count ?? 0,
  })
}