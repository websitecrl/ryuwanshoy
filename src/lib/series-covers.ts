import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Covers used to be keyed cover-{slug} (and cover-undefined whenever series
// PATCH ran without a slug), so one legacy file can still back several
// series. Deleting it for one series would break the others' covers.

/** Object path of a cover URL — ignores origin and the old "?v=" suffix. */
function objectPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

/**
 * Returns the covers in `coverUrls` that no series row (other than
 * `exceptSeriesId`) still points at — the ones safe to delete from R2.
 *
 * Call it AFTER deleting the owning rows, so rows deleted together don't
 * count as sharing with each other. One query for any number of covers,
 * which keeps bulk deletes under the Workers subrequest cap. If the lookup
 * fails it returns [] — orphaning a file beats breaking a live cover.
 */
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
