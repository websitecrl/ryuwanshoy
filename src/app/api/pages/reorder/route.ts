import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePublicContent } from '@/lib/cache/public-cache'
import { isUuid } from '@/lib/validation'

type ReorderResponse = { data: null; error: string | null }

// sanity cap on the body; real chapters are far below this
const MAX_PAGES = 2000

function isUuidList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isUuid)
}

/**
 * admin: set the page order of one chapter.
 *
 * Body: { chapter_id: uuid, page_ids: uuid[] } with page_ids in reading order.
 *
 * One rpc -> renumber_pages() numbers the whole chapter 1..N in a single
 * transaction, so the order is fully saved or not changed at all, and the
 * request costs 1 Supabase subrequest for any chapter size (one update per
 * page hit the Workers free plan cap of 50 at ~45 pages).
 *
 * 400 -> bad body, or a listed id that is not a page of that chapter
 *        (the function checks this and changes nothing).
 * 500 -> the rpc failed; nothing was changed.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ReorderResponse>(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { chapter_id, page_ids } = (body ?? {}) as Record<string, unknown>

  if (!isUuid(chapter_id)) {
    return NextResponse.json<ReorderResponse>(
      { data: null, error: 'chapter_id is required' },
      { status: 400 }
    )
  }
  if (!isUuidList(page_ids) || page_ids.length === 0 || page_ids.length > MAX_PAGES) {
    return NextResponse.json<ReorderResponse>(
      { data: null, error: 'page_ids must be a non-empty array of page ids' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.rpc('renumber_pages', {
    p_chapter_id: chapter_id,
    p_page_ids:   page_ids,
  })

  if (error) {
    // 22023: raised by renumber_pages() when an id is not a distinct page of the chapter
    if (error.code === '22023') {
      return NextResponse.json<ReorderResponse>(
        { data: null, error: 'These pages do not all belong to this chapter. Reload the page and try again.' },
        { status: 400 }
      )
    }
    console.error('PATCH /api/pages/reorder error:', error)
    return NextResponse.json<ReorderResponse>(
      { data: null, error: 'Failed to reorder pages' },
      { status: 500 }
    )
  }

  revalidatePublicContent('PATCH /api/pages/reorder')
  return NextResponse.json<ReorderResponse>({ data: null, error: null })
}
