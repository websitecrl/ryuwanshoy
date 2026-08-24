import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET /api/posts/[id] ──────────────────────────────────────────────────────
// Admin only
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/posts/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// ─── PATCH /api/posts/[id] ────────────────────────────────────────────────────
// Admin only
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await req.json()

    const validTypes = ['sketch', 'drawing', 'meme', 'other']
    if (body.post_type && !validTypes.includes(body.post_type)) {
      return NextResponse.json(
        { error: 'post_type must be sketch, drawing, meme or other' },
        { status: 400 }
      )
    }

    const update: {
      title?: string | null
      description?: string | null
      post_type?: string
      image_url?: string
    } = {}

    if ('title'       in body) update.title       = body.title?.trim() || null
    if ('description' in body) update.description = body.description?.trim() || null
    if ('post_type'   in body) update.post_type   = body.post_type

    if (body.imageBase64) {
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('posts')
        .select('image_url')
        .eq('id', id)
        .single()

      if (fetchErr) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }

      try {
         if (body.imageBase64.length > 34_000_000) {
          return NextResponse.json({ error: 'Image too large'}, { status: 413 })
        }
        
        const sharp = (await import('sharp')).default
        const commaIdx  = body.imageBase64.indexOf(',')
        const buffer    = Buffer.from(body.imageBase64.slice(commaIdx + 1), 'base64')
        const processed = await sharp(buffer)
          .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer()
        const webpBase64 = `data:image/webp;base64,${processed.toString('base64')}`
        update.image_url = await uploadToR2(webpBase64, 'posts')
      } catch {
        return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
      }

      if (existing.image_url) {
        deleteFromR2(existing.image_url).catch(err =>
          console.warn('[PATCH /api/posts] R2 delete warning:', err)
        )
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PATCH /api/posts/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

// ─── DELETE /api/posts/[id] ───────────────────────────────────────────────────
// Admin only
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    const { data: post, error: fetchErr } = await supabaseAdmin
      .from('posts')
      .select('image_url')
      .eq('id', id)
      .single()

    if (fetchErr) {
      if (fetchErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      throw fetchErr
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', id)

    if (deleteErr) throw deleteErr

    if (post.image_url) {
      deleteFromR2(post.image_url).catch(err =>
        console.warn('[DELETE /api/posts] R2 delete warning:', err)
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/posts/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}