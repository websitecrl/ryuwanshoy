import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { createClient } from '@/lib/supabase/server'

const filter = require('leo-profanity')
filter.loadDictionary('en')

function normalize(text: string): string {
  return text.toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/@/g, 'a').replace(/0/g, 'o').replace(/1/g, 'i')
    .replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
    .replace(/\$/g, 's').replace(/!/g, 'i').replace(/\*/g, '')
    .replace(/\+/g, 't')
}

const HARD_BLOCK = [
  'nigger', 'nigga', 'niggah', 'niga', 'nigah', 'niger',
  'chink', 'gook', 'spic', 'kike', 'faggot', 'fagot',
  'dyke', 'retard', 'tranny', 'ngga', 'ngger', 'nhher', 'nhha'
]

function containsHardBlock(text: string): boolean {
  const n = normalize(text)
  const original = text.toLowerCase()
  const deduped = original.replace(/(.)\1+/g, '$1')
  return HARD_BLOCK.some(w => n.includes(w) || original.includes(w) || deduped.includes(w))
}

function isProfane(text: string): boolean {
  return filter.check(text) || filter.check(normalize(text)) || containsHardBlock(text)
}

// PATCH — edit comment (requires edit_token)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { content, edit_token } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

  // Verify token matches
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('edit_token')
    .eq('id', id)
    .single()

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
  }
  if (comment.edit_token !== edit_token) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  //Profanity check - same as POST /api/comments
  if (isProfane(content.trim())) {
    return NextResponse.json({ error: 'Your comment contains inappropriate language.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, content, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — admin or token holder
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Check if admin session exists
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not admin — verify edit_token
    const { edit_token } = await req.json()

    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('edit_token')
      .eq('id', id)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
    }
    if (comment.edit_token !== edit_token) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }
  }

  // Use supabaseAdmin for the actual delete
  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}