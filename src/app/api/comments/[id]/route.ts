import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ─── Normalize text before checking ──────────────────────────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/@/g,  'a')
    .replace(/0/g,  'o')
    .replace(/1/g,  'i')
    .replace(/3/g,  'e')
    .replace(/4/g,  'a')
    .replace(/5/g,  's')
    .replace(/\$/g, 's')
    .replace(/!/g,  'i')
    .replace(/\*/g, '')
    .replace(/\+/g, 't')
}

// ─── Hard block list ──────────────────────────────────────────────────────────
// Entries are in normalized form — normalize() is applied to both input and
// each word before matching, so leetspeak variants are caught automatically.
const HARD_BLOCK: string[] = [
  // Racial slurs
  'nigger', 'nigga', 'niggah', 'niga', 'nigah', 'niger',
  'ngga', 'ngger', 'kneegga', 'negga',
  'chink', 'gook', 'spic', 'wetback',
  'beaner', 'kike', 'cracker', 'honky', 'coon',
  'porch monkey', 'jungle bunny', 'tar baby',
  'zipperhead', 'slant', 'slope',
  'towelhead', 'raghead', 'sand nigger', 'camel jockey',
  'redskin', 'injun', 'prairie nigger', 'halfbreed',
  'mulatto', 'sambo', 'pickaninny',
  'wog', 'golliwog', 'dago', 'guinea', 'greaser',
  'paddy', 'mick', 'kraut', 'hymie', 'jap', 'nip',

  // Homophobic / transphobic slurs
  'faggot', 'fagot', 'fag',
  'dyke', 'tranny', 'shemale', 'heshe', 'sodomite',

  // Ableist slurs
  'retard', 'retarded', 'spastic', 'spaz', 'mongoloid', 'cripple',

  // Misogynistic / sexual slurs
  'whore', 'slut', 'cunt', 'bitch', 'skank', 'thot',

  // Filipino / Tagalog
  'gago', 'gaga', 'bobo', 'tanga', 'ulol',
  'hudas', 'lintik', 'siraulo', 'gunggong', 'engot', 'inutil',
  'paksyet', 'pekpek', 'titi', 'jakol', 'kantot', 'kantotin',
  'salsal', 'pepe', 'etits', 'bayag', 'puke',

  // Self-harm / violent threats
  'kill yourself', 'kys',
  'go kill yourself', 'kill urself',
  'go die', 'die already',
  'i will kill you', 'i will hurt you',
  'you should die', 'hope you die',
  'end your life', 'neck yourself',
  'rope yourself', 'drink bleach',
  'go hang yourself', 'slit your wrists',
]

function isProfane(text: string): boolean {
  const normalizedInput = normalize(text)
  return HARD_BLOCK.some(word => normalizedInput.includes(normalize(word)))
}

// ─── PATCH /api/comments/[id] ─────────────────────────────────────────────────
// Edit a comment — requires matching edit_token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { content, edit_token } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
  }
  if (content.length > 300) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  if (!user) {
    // Non-admin path — parse body safely; it may be empty or malformed
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

  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}