import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'
import sharp from 'sharp'

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { base64, folder } = await req.json()

  const MAX_SIZE = 34_000_000
  if (base64 && base64.length > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Image size exceeds the limit of 25MB' },
      { status: 413 }
    )
  }
  if (!base64 || !folder) {
    return NextResponse.json(
      { error: 'base64 and folder are required' },
      { status: 400 }
    )
  }

  const matches = base64.match(/^data:(.+);base64,(.+)$/)
  if (!matches) {
    return NextResponse.json({ error: 'Invalid base64 string' }, { status: 400 })
  }

  let uploadBase64 = base64
  if (folder === 'hero-banners') {
    const buffer  = Buffer.from(matches[2], 'base64')
    const resized = await sharp(buffer)
      .resize(1920, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    uploadBase64 = `data:image/webp;base64,${resized.toString('base64')}`
  }

  const url = await uploadToR2(uploadBase64, folder)
  return NextResponse.json({ url })
}