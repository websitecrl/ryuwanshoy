import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { InvalidImageError, uploadToR2 } from '@/lib/r2'
import { isCursor, readLimit } from '@/lib/cursor'
import { normalizePostType, POST_LIST_FIELDS, POSTS_PAGE_SIZE } from '@/lib/posts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_PAGE_SIZE = 100

// ─── GET /api/posts ───────────────────────────────────────────────────────────
// Public, newest first, one page at a time:
//   ?type=sketch|drawing|meme|other  [&before=<cursor>] [&limit=1..100]
//   → { data, nextCursor }   (nextCursor: pass as ?before= for the next page)
// Admin only: ?all=1 returns every post in one list (the admin posts table).
// Posts have no draft/hidden state, so the service role client is safe here.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const all = params.get('all') === '1'
    if (all) {
      const auth = await requireAdmin()
      if (auth instanceof NextResponse) return auth
    }

    const before = params.get('before')
    if (before !== null && !isCursor(before)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
    const limit = readLimit(params.get('limit'), POSTS_PAGE_SIZE, MAX_PAGE_SIZE)
    const type = normalizePostType(params.get('type'))

    let query = supabaseAdmin
      .from('posts')
      .select(POST_LIST_FIELDS)
      .order('created_at', { ascending: false })

    if (type) query = query.eq('post_type', type)
    if (before) query = query.lt('created_at', before)
    // One extra row tells us whether another page exists.
    if (!all) query = query.limit(limit + 1)

    const { data, error } = await query
    if (error) throw error

    const hasMore = !all && data.length > limit
    const page = hasMore ? data.slice(0, limit) : data
    const last = page[page.length - 1]

    return NextResponse.json({
      data: page,
      nextCursor: hasMore && last?.created_at ? last.created_at : null,
    })
  } catch (err) {
    console.error('GET /api/posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// ─── POST /api/posts ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('POST /api/posts')

  try {
    const body = await req.json()

    const MAX_SIZE = 34_000_000
    if (body.imageBase64 && body.imageBase64.length > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 413 })
    }
    if (!body.imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
    }

    let imageUrl: string
      try {
        // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
        // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
        // currently broken on this deployment. See src/lib/image-processing.ts.
        imageUrl = await uploadToR2(body.imageBase64, 'posts')
      } catch (uploadErr) {
        if (uploadErr instanceof InvalidImageError) {
          return NextResponse.json({ error: uploadErr.message }, { status: 400 })
        }
        console.error('R2 upload error:', uploadErr)
        return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
      }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        title:       body.title?.trim() || null,
        description: body.description?.trim() || null,
        post_type:   body.post_type ?? 'illustration',
        image_url:   imageUrl,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/posts error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}