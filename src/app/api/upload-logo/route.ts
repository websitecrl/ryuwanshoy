import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── POST — admin only ────────────────────────────────────────────────────────
// Body: { imageBase64: string, type?: 'logo' | 'qr' }
// type defaults to 'logo' for backward compat
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    const MAX_SIZE = 34_000_000
    if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
    }
    if (body.imageBase64.length > MAX_SIZE) {
      return NextResponse.json({ error: 'Image size exceeds the limit of 25MB' }, { status: 413 })
    }

    // Determine which upload this is — 'logo' (default) or 'qr'
    const uploadType = body.type === 'qr' ? 'qr' : 'logo'
    const filename   = uploadType === 'qr' ? 'gcash-qr' : 'site-logo'

    const imageUrl = await uploadToR2(body.imageBase64, 'settings', filename)

    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('id')
      .single()

    const updatePayload =
      uploadType === 'qr'
        ? { gcash_qr_url: imageUrl, updated_at: new Date().toISOString() }
        : { logo_url: imageUrl, updated_at: new Date().toISOString() }

    if (existing?.id) {
      await supabaseAdmin
        .from('settings')
        .update(updatePayload)
        .eq('id', existing.id)
    }

    return NextResponse.json({ url: imageUrl })
  } catch (error) {
    console.error('POST /api/upload-logo error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}