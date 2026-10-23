import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { serverError } from '@/lib/api-errors'
import { deleteUnusedFiles, findUnusedFiles } from '@/lib/storage-cleanup'

export const dynamic = 'force-dynamic'

// one R2 DeleteObjects batch
const MAX_KEYS = 1000

// admin, read only -> { files, totalBytes, scannedCount, usedCount }
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await findUnusedFiles())
  } catch (err) {
    return serverError('GET /api/storage/unused', err, 'Could not check storage. Please try again.')
  }
}

// admin. { keys } from GET -> rescan -> delete still-unused -> { deleted, failed, skipped, freedBytes }
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
