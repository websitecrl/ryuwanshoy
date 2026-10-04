import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteManyFromR2, InvalidImageError } from '@/lib/r2'

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

    let oldImageUrl: string | null = null

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

        // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
        // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
        // currently broken on this deployment. See src/lib/image-processing.ts.
        update.image_url = await uploadToR2(body.imageBase64, 'posts')
      } catch (uploadErr) {
        if (uploadErr instanceof InvalidImageError) {
          return NextResponse.json({ error: uploadErr.message }, { status: 400 })
        }
        console.error('[PATCH /api/posts/[id]] R2 upload error:', uploadErr)
        return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
      }

      oldImageUrl = existing.image_url
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

    // R2 cleanup is awaited (Workers can cut off promises still pending after
    // the response) and happens only once we know which file the row points
    // at: the old image after a successful update, the new upload after a
    // failed one.
    const orphan = error ? update.image_url : oldImageUrl
    if (orphan) {
      const { failed } = await deleteManyFromR2([orphan])
      if (failed.length) {
        console.error('[PATCH /api/posts] R2 object not deleted:', failed)
      }
    }

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

    // Awaited — Workers can cut off promises still pending after the response.
    if (post.image_url) {
      const { failed } = await deleteManyFromR2([post.image_url])
      if (failed.length) {
        console.error('[DELETE /api/posts] R2 object not deleted:', failed)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/posts/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}