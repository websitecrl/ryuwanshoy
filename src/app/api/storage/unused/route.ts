import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { serverError } from '@/lib/api-errors'
import { deleteUnusedFiles, findUnusedFiles } from '@/lib/storage-cleanup'

export const dynamic = 'force-dynamic'

// Most keys one DELETE may carry; matches one R2 DeleteObjects batch.
const MAX_KEYS = 1000

// ─── GET /api/storage/unused ──────────────────────────────────────────────────
// Admin only. Read only: lists files in the public bucket nothing uses.
//   → { files: [{ key, size, lastModified }], totalBytes, scannedCount, usedCount }
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await findUnusedFiles())
  } catch (err) {
    return serverError('GET /api/storage/unused', err, 'Could not check storage. Please try again.')
  }
}

// ─── DELETE /api/storage/unused ───────────────────────────────────────────────
// Admin only. Body { keys: string[] } from a previous GET. The server scans
// again and deletes only keys that are still unused (see deleteUnusedFiles).
//   → { deleted, failed, skipped, freedBytes }
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const keys = (body as { keys?: unknown } | null)?.keys
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS ||
      !keys.every(k => typeof k === 'string' && k.length > 0)) {
    return NextResponse.json(
      { error: `keys must be a list of 1 to ${MAX_KEYS} file keys` },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json(await deleteUnusedFiles(keys as string[]))
  } catch (err) {
    return serverError('DELETE /api/storage/unused', err, 'Could not delete files. Please try again.')
  }
}
