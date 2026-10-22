import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Old covers were keyed by slug, so one legacy file can back several series.

/** Object path of a cover URL — ignores origin and the old "?v=" suffix. */
function objectPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

/** Covers no other series still uses, safe to delete. Call after deleting the rows; returns [] if the lookup fails. */
export async function filterUnsharedCovers(
  coverUrls: string[],
  exceptSeriesId?: string
): Promise<string[]> {
  if (!coverUrls.length) return []

  let query = supabaseAdmin
    .from('series')
    .select('cover_image')
    .not('cover_image', 'is', null)
  if (exceptSeriesId) query = query.neq('id', exceptSeriesId)

  const { data, error } = await query
  if (error) {
    console.error('filterUnsharedCovers: lookup failed, keeping covers:', error)
    return []
  }

  const inUse = new Set(data.map(r => objectPath(r.cover_image ?? '')))
  return [...new Set(coverUrls)].filter(url => !inUse.has(objectPath(url)))
}
