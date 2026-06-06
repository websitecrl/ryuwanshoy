import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { deleteFromR2 } from '@/lib/r2'

// ─── PATCH — admin only ───────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('hero_slides')
    .update({
      series_id:    body.series_id    ?? null,
      chapter_id:   body.chapter_id   ?? null,
      banner_image: body.banner_image ?? null,
      headline:     body.headline     ?? null,
      is_visible:   body.is_visible,
      order_index:  body.order_index,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ─── DELETE — admin only ──────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  // Fetch banner_image first so we can clean up R2
  const { data: slide, error: fetchError } = await supabaseAdmin
    .from('hero_slides')
    .select('banner_image')
    .eq('id', id)
    .single()

  if (fetchError || !slide) {
    return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('hero_slides')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Clean up R2 after DB delete succeeds
  if (slide.banner_image) {
    deleteFromR2(slide.banner_image).catch(err =>
      console.warn('[DELETE /api/hero-slides] R2 delete warning:', err)
    )
  }

  return NextResponse.json({ success: true })
}