import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ─── Normalize text before checking ──────────────────────────────────────────
// Collapses repeated chars, maps common leetspeak substitutions to base letters
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')   // dedupe repeated chars (aaaa → a)
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

// ─── Hard block list (English only) ──────────────────────────────────────────
// All entries are already in their normalized form (post-leetspeak substitution).
// normalize() is applied to both the input AND each word before matching,
// so you don't need to add leetspeak variants here.
const HARD_BLOCK: string[] = [
  // Racial slurs
  'nigger', 'nigga', 'niggah', 'niga', 'nigah', 'niger','negro',
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
  'retard', 'retarded',
  'spastic', 'spaz',
  'mongoloid', 'cripple',

  // Misogynistic / sexual slurs
  'whore', 'slut', 'cunt', 'bitch', 'skank', 'thot',

  // Filipino / Tagalog
  'gago', 'gaga', 'bobo', 'tanga', 'ulol',
  'hudas', 'lintik', 'siraulo', 'gunggong', 'engot', 'inutil',
  'paksyet', 'pekpek', 'titi', 'jakol', 'kantot', 'kantotin',
  'salsal', 'pepe', 'etits', 'bayag', 'puke',

  // Bisaya / Cebuano
  'yuta', 'buang', 'boang', 'atay', 'piste', 'pisti',
  'bilat', 'boto', 'pisot',

  // Self-harm / violent threats (multi-word — matched via .includes())
  'kill yourself', 'kys',
  'go kill yourself', 'kill urself',
  'go die', 'die already',
  'i will kill you', 'i will hurt you',
  'you should die', 'hope you die',
  'end your life', 'neck yourself',
  'rope yourself', 'drink bleach',
  'go hang yourself', 'slit your wrists',
]

// ─── Core check ───────────────────────────────────────────────────────────────
// Normalize both the input AND each blocked word before comparing.
// This catches all leetspeak / repeated-char bypasses in one pass.
function isProfane(text: string): boolean {
  const normalizedInput = normalize(text)
  return HARD_BLOCK.some(word => normalizedInput.includes(normalize(word)))
}

// ─── GET /api/comments ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chapterId = searchParams.get('chapter_id')
  const postId    = searchParams.get('post_id')
  const seriesId  = searchParams.get('series_id')

  if (!chapterId && !postId && !seriesId) {
    return NextResponse.json(
      { error: 'chapter_id, post_id, or series_id is required' },
      { status: 400 }
    )
  }

  let query = supabaseAdmin
    .from('comments')
    .select('id, name, content, created_at, updated_at, parent_id')
    .order('created_at', { ascending: true })

  if (chapterId) query = query.eq('chapter_id', chapterId)
  if (postId)    query = query.eq('post_id', postId)
  if (seriesId)  query = query.eq('series_id', seriesId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── POST /api/comments ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('CF-Connecting-IP')
    ?? req.headers.get('x-forwarded-for')
    ?? 'unknown'

  if (!checkRateLimit(`comment:${ip}`, 3, 60_000)) {
    return NextResponse.json(
      { error: 'You can only post one comment per minute.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { chapter_id, series_id, post_id, content, parent_id } = body

  if ((!chapter_id && !post_id && !series_id) || !content?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
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

  const edit_token = uuidv4()

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      chapter_id: chapter_id ?? null,
      series_id:  series_id  ?? null,
      post_id:    post_id    ?? null,
      parent_id:  parent_id  ?? null,
      name:       'Anonymous',
      content:    content.trim(),
      edit_token,
    })
    .select('id, name, content, created_at, updated_at, parent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, edit_token }, { status: 201 })
}