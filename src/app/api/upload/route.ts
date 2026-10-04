import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { InvalidImageError, uploadToR2 } from '@/lib/r2'

// Folders this generic endpoint may write to. Pages, covers, posts and the
// logo upload through their own routes.
const ALLOWED_FOLDERS = ['hero-banners']

// ─── POST — admin only ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { base64, folder } = await req.json()

  if (typeof base64 !== 'string' || typeof folder !== 'string' || !base64 || !folder) {
    return NextResponse.json(
      { error: 'base64 and folder are required' },
      { status: 400 }
    )
  }

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
  }

  // ~25MB decoded (base64 is 4/3 the size), same cap as the other upload routes.
  const MAX_SIZE = 34_000_000
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
    // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
    // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
    // currently broken on this deployment. See src/lib/image-processing.ts.
    const url = await uploadToR2(base64, folder)
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('POST /api/upload error:', err)
    return NextResponse.json(
      { error: 'Image processing failed' },
      { status: 500 }
    )
  }
}