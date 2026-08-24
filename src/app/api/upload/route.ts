import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

// Folder-specific max widths — pages and hero banners get more room
const MAX_WIDTHS: Record<string, number> = {
  'hero-banners': 1920,
  'pages':        1200,
  'covers':       920,
  'posts':        1200,
  'settings':     400,
}
const DEFAULT_MAX_WIDTH = 1200

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { base64, folder } = await req.json()

  if (!base64 || !folder) {
    return NextResponse.json(
      { error: 'base64 and folder are required' },
      { status: 400 }
    )
  }

  const MAX_SIZE = 50_000_000
  if (base64.length > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Image size exceeds the limit of 25MB' },
      { status: 413 }
    )
  }

  const commaIdx = base64.indexOf(',')
  if (commaIdx === -1) {
    return NextResponse.json({ error: 'Invalid base64 string' }, { status: 400 })
  }

  try {

    const sharp = (await import('sharp')).default
    const buffer    = Buffer.from(base64.slice(commaIdx + 1), 'base64')
    const maxWidth  = MAX_WIDTHS[folder] ?? DEFAULT_MAX_WIDTH
    const processed = await sharp(buffer)
      .resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    const uploadBase64 = `data:image/webp;base64,${processed.toString('base64')}`
    const url = await uploadToR2(uploadBase64, folder)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json(
      { error: 'Image processing failed' },
      { status: 500 }
    )
  }
}
