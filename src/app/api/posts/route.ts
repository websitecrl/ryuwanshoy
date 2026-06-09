import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// ─── GET /api/posts ───────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
} 

// ─── POST /api/posts ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

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
        const commaIdx  = body.imageBase64.indexOf(',')
        const buffer    = Buffer.from(body.imageBase64.slice(commaIdx + 1), 'base64')
        const processed = await sharp(buffer)
          .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer()
        const webpBase64 = `data:image/webp;base64,${processed.toString('base64')}`
        imageUrl = await uploadToR2(webpBase64, 'posts')
      } catch (uploadErr) {
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