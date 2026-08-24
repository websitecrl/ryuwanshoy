import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

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

    const sharp = (await import('sharp')).default
    const commaIdx  = body.imageBase64.indexOf(',')
    const buffer    = Buffer.from(body.imageBase64.slice(commaIdx + 1), 'base64')
    const processed = await sharp(buffer)
      .resize(400, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    const webpBase64 = `data:image/webp;base64,${processed.toString('base64')}`

    const imageUrl = await uploadToR2(webpBase64, 'settings', 'site-logo')

    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('id')
      .single()

    if (existing?.id) {
      await supabaseAdmin
        .from('settings')
        .update({ logo_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }

    return NextResponse.json({ url: imageUrl })
  } catch (error) {
    console.error('POST /api/upload-logo error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}