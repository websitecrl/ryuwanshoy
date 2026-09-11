import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

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
    // TEMPORARY STOPGAP: skip resize/webp conversion, upload original
    // as-is. Both Cloudflare Images binding and @cf-wasm/photon are
    // currently broken on this deployment. See src/lib/image-processing.ts.
    const url = await uploadToR2(base64, folder)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json(
      { error: 'Image processing failed' },
      { status: 500 }
    )
  }
}