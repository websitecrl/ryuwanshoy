import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { deleteConfirmedDrafts, getDraftPreview } from '@/lib/drafts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── GET /api/drafts ──────────────────────────────────────────────────────────
// Admin only — what "Delete all drafts" would remove right now. `count` feeds
// the sidebar badge; the lists feed the confirm dialog. Same rule as DELETE
// (see src/lib/drafts.ts), so the badge always matches what gets deleted.
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await getDraftPreview())
  } catch (err) {
    console.error('GET /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 })
  }
}

// ─── DELETE /api/drafts ───────────────────────────────────────────────────────
// Admin only — body: { seriesIds: string[], chapterIds: string[] }, the ids the
// confirm dialog showed. Deletes only those that still match the draft rule;
// never a published chapter, never a series with a published chapter.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const isIdList = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every(id => typeof id === 'string')
  const { seriesIds, chapterIds } = (body ?? {}) as Record<string, unknown>

  if (!isIdList(seriesIds) || !isIdList(chapterIds)) {
    return NextResponse.json(
      { error: 'seriesIds and chapterIds must be string arrays' },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json(await deleteConfirmedDrafts({ seriesIds, chapterIds }))
  } catch (err) {
    console.error('DELETE /api/drafts error:', err)
    return NextResponse.json({ error: 'Failed to delete drafts' }, { status: 500 })
  }
}
