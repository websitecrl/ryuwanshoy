import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isProfane } from '@/lib/profanity'
import { rateLimit } from '@/lib/rate-limit-cf'
import { serverError } from '@/lib/api-errors'

// ─── PATCH /api/comments/[id] ─────────────────────────────────────────────────
// Edit a comment — requires matching edit_token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const limited = await rateLimit(req, 'COMMENT_EDIT_LIMITER')
  if (limited) return limited

  let content: string | undefined
  let edit_token: string | undefined
  try {
    const body = await req.json()
    content = body?.content
    edit_token = body?.edit_token
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Authorization first
  const { data: comment, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('edit_token')
    .eq('id', id)
    .single()

  if (fetchError || !comment) {
    return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
  }
  if (comment.edit_token !== edit_token) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  // Validation second
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
  }
  if (content.length > 300) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }
  if (isProfane(content.trim())) {
    return NextResponse.json(
      { error: 'Your comment contains prohibited language.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, content, created_at, updated_at')
    .single()

  if (error) return serverError('PATCH /api/comments/[id]', error, 'Failed to update comment.')
  return NextResponse.json(data)
}

// ─── DELETE /api/comments/[id] ────────────────────────────────────────────────
// Admin can delete freely; non-admin must supply matching edit_token
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Both sides must be set: undefined === undefined would make an anonymous
  // caller "admin" if ADMIN_USER_ID were missing from the environment.
  const adminId = process.env.ADMIN_USER_ID
  const isAdmin = !!user && !!adminId && user.id === adminId

  if (!isAdmin) {
    // Admin moderation (e.g. bulk deletes from NotificationBell) skips the limit;
    // everyone else is limited before any DB access.
    const limited = await rateLimit(req, 'COMMENT_EDIT_LIMITER')
    if (limited) return limited

    let edit_token: string | undefined
    try {
      const body = await req.json()
      edit_token = body?.edit_token
    } catch {
      // No body sent — treat as unauthorized
    }

    if (!edit_token) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const { data: comment, error: fetchError } = await supabaseAdmin
      .from('comments')
      .select('edit_token')
      .eq('id', id)
      .single()

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
    }
    if (comment.edit_token !== edit_token) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', id)

  if (error) return serverError('DELETE /api/comments/[id]', error, 'Failed to delete comment.')
  return NextResponse.json({ success: true })
}