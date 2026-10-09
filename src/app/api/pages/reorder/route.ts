import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'

// ─── PATCH — admin only ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('PATCH /api/pages/reorder')

  try {
    const body = await req.json()

    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return NextResponse.json<{ data: null; error: string }>(
        { data: null, error: 'pages array is required' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      body.pages.map(({ id, page_number }: { id: string; page_number: number }) =>
        supabaseAdmin
          .from('pages')
          .update({ page_number })
          .eq('id', id)
      )
    )

    // Supabase returns errors instead of throwing them, so check each one.
    // Some updates may have landed; the client sends the full order, so a
    // retry puts every page right.
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`PATCH /api/pages/reorder: ${failed.length} of ${results.length} updates failed:`, failed[0]?.error)
      return NextResponse.json<{ data: null; error: string }>(
        { data: null, error: 'Some pages could not be reordered. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json<{ data: null; error: null }>({ data: null, error: null })
  } catch (error) {
    console.error('PATCH /api/pages/reorder error:', error)
    return NextResponse.json<{ data: null; error: string }>(
      { data: null, error: 'Failed to reorder pages' },
      { status: 500 }
    )
  }
}