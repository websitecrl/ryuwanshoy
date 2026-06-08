import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { uploadToR2 } from '@/lib/r2'

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

  const url = await uploadToR2(base64, folder)
  return NextResponse.json({ url })
}