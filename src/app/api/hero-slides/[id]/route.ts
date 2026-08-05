import 'server-only'
import type { TablesUpdate } from '@/types/database'
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

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Only touch fields actually sent in the body — this is a PATCH, not a
  // full replace. Writing every column unconditionally (the old behavior)
  // meant editing just the headline silently wiped banner_image and
  // chapter_id to null whenever they weren't included in the request.
  const updatable = ['series_id', 'chapter_id', 'banner_image', 'headline', 'is_visible', 'order_index'] as const
  const payload: TablesUpdate<'hero_slides'> = {}
  for (const field of updatable) {
    if (field in body) payload[field] = body[field]
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('hero_slides')
    .update(payload)
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