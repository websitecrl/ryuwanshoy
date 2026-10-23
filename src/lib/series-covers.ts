import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

// old slug-keyed covers can back several series

/** cover URL -> path (no origin, no "?v=") */
function objectPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

/** covers no other series uses -> safe to delete. call after deleting rows; lookup fails -> [] */
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
