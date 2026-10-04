import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2, deleteManyFromR2, InvalidImageError } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── POST — admin only ────────────────────────────────────────────────────────
// Body: { imageBase64: string }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
    }
    if (body.imageBase64.length > 34_000_000) {
      return NextResponse.json({ error: 'Image size exceeds the limit of 25MB' }, { status: 413 })
    }

    // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
    // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
    // currently broken on this deployment. See src/lib/image-processing.ts.
    const imageUrl = await uploadToR2(body.imageBase64, 'settings')

    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('id, logo_url')
      .single()

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from('settings')
        .update({ logo_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      // Each upload gets its own key, so the file the row no longer points
      // at has to be removed: the old logo on success, the new one on failure.
      const orphan = error ? imageUrl : existing.logo_url
      if (orphan) {
        const { failed } = await deleteManyFromR2([orphan])
        if (failed.length) console.error('POST /api/upload-logo: logo not deleted:', failed)
      }

      if (error) throw error
    }

    return NextResponse.json({ url: imageUrl })
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/upload-logo error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}