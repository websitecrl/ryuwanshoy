import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { countUnreadFeedback } from '@/lib/feedback-server'
import { isUuid } from '@/lib/validation'

type RouteContext = { params: Promise<{ id: string }> }

// ─── PATCH /api/feedback/[id] ─────────────────────────────────────────────────
// Admin only. Body: { is_read: boolean }
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  let body: { is_read?: unknown }
  try {
    body = (await req.json()) as { is_read?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (typeof body?.is_read !== 'boolean') {
    return NextResponse.json({ error: 'is_read must be true or false.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('feedback')
    .update({ is_read: body.is_read })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('PATCH /api/feedback/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, unread: await unreadOrNull() })
}

// ─── DELETE /api/feedback/[id] ────────────────────────────────────────────────
// Admin only.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { error } = await supabaseAdmin.from('feedback').delete().eq('id', id)
  if (error) {
    console.error('DELETE /api/feedback/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, unread: await unreadOrNull() })
}

/** Fresh unread count, or null if counting failed (the action itself already
 *  succeeded, so it isn't turned into an error; the inbox keeps its count). */
async function unreadOrNull(): Promise<number | null> {
  try {
    return await countUnreadFeedback()
  } catch (err) {
    console.error('feedback unread count error:', err)
    return null
  }
}
