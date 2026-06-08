import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase/admin'

const filter = require('leo-profanity')

// ─── Custom word list ─────────────────────────────────────────────────────────
// Add Filipino, Bisaya, Tagalog slurs + common variants on top of the base list

filter.loadDictionary('en')

filter.add([
  // Filipino / Tagalog
  'gago', 'gaga', 'g4go', 'bobo', 'b0b0', 'tanga', 't4nga', 'ulol',
  'hudas', 'lintik', 'siraulo', 'gunggong', 'engot', 'inutil',
  'paksyet', 'pekpek', 'titi', 'jakol', 'kantot', 'kantotin',
  'salsal', 'pepe', 'etits', 'bayag', 'puke',

  // Bisaya / Cebuano
  'yuta', 'buang', 'buanga', 'boang', 'atay', 'piste', 'pisti',
  'bilat', 'boto', 'pisot', 'inahan', 'amahan',

  // Leetspeak / common bypasses
  'f*ck', 'f**k', 'sh*t', 'b*tch', 'a**hole',
  'fvck', 'fvk', 'f4ck', 'sh!t', 'sh1t', 'b1tch',
  'a55', 'a$$', '@ss',

  // Racism / slurs (English)
  'nigger', 'nigga', 'n1gger', 'n1gga',
  'chink', 'ch1nk', 'gook', 'spic', 'sp1c',
  'kike', 'wetback', 'beaner', 'cracker',
  'faggot', 'f4ggot', 'fagot', 'dyke',
  'retard', 'ret4rd', 'retarded',
  'tranny', 'tr4nny',  
 
  // Common hate phrases
  'kill yourself', 'kys', 'go kill', 'die already',
  'go die', 'kill urself',
])

// ─── Normalize text before checking ──────────────────────────────────────────
// Catches simple leetspeak: @ → a, 0 → o, 1 → i/l, 3 → e, 4 → a, 5 → s
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\*/g, '')
    .replace(/\+/g, 't')
}

const HARD_BLOCK = [
  'nigger', 'nigga', 'niggah', 'niga', 'nigah', 'niger',
  'chink', 'gook', 'spic',
  'kike', 'faggot', 'fagot', 'dyke', 'retard', 'tranny',
  'ngga', 'ngger', 'nhher', 'nhha'
]

function containsHardBlock(text: string): boolean {
  const n = normalize(text)
  const original = text.toLowerCase()
  const deduped = original.replace(/(.)\1+/g, '$1')
  return HARD_BLOCK.some(word =>
    n.includes(word) ||
    original.includes(word) ||
    deduped.includes(word)
  )
}

function isProfane(text: string): boolean {
  return filter.check(text)
    || filter.check(normalize(text))
    || containsHardBlock(text)
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
  const { chapter_id, series_id, post_id, name, content, parent_id } = body

  if ((!chapter_id && !post_id && !series_id) || !content?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (content.length > 300) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

  // ── Profanity check — content ─────────────────────────────────────────────
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