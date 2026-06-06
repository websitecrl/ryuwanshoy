import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import type { ApiResponse } from '@/types/database'

// ─── PATCH — admin only ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'pages array is required' },
        { status: 400 }
      )
    }

    await Promise.all(
      body.pages.map(({ id, page_number }: { id: string; page_number: number }) =>
        supabaseAdmin
          .from('pages')
          .update({ page_number })
          .eq('id', id)
      )
    )

    return NextResponse.json<ApiResponse<null>>({ data: null, error: null })
  } catch (error) {
    console.error('PATCH /api/pages/reorder error:', error)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Failed to reorder pages' },
      { status: 500 }
    )
  }
}