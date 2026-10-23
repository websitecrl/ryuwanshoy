import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { deleteConfirmedDrafts, getDraftPreview } from '@/lib/drafts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// admin: draft preview -> badge count + dialog lists (same rule as DELETE)
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

// admin: { seriesIds, chapterIds } shown -> delete those still drafts
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  revalidatePublicContent('DELETE /api/drafts')

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
