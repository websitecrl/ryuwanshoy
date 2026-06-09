import 'server-only'
import { getR2StorageBytes } from '@/lib/r2'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

const BUCKET_MAX_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB

// ─── GET — admin only ─────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const used    = await getR2StorageBytes()
  const percent = parseFloat(((used / BUCKET_MAX_BYTES) * 100).toFixed(2))
  const usedGB  = (used / (1024 ** 3)).toFixed(2)

  return NextResponse.json({
    usedBytes:   used,
    usedGB:      parseFloat(usedGB),
    totalGB:     10,
    percentUsed: percent,
  })
}
