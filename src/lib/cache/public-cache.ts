import 'server-only'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

// How long a public page or query result may be served from cache before the
// next visitor triggers a background refresh. Admin writes purge immediately
// (see revalidatePublicContent), so this is only the safety net for a write
// path that forgot to purge.
// Page files must repeat the literal (`export const revalidate = 60`): Next
// reads that export statically and rejects imported values.
export const PUBLIC_REVALIDATE_SECONDS = 60

// One tag for every cached public read. Writes are rare (one admin), so a
// coarse purge-everything is cheaper than tracking which slug/page a write
// touched, and it can't miss an old slug after a rename.
export const PUBLIC_CONTENT_TAG = 'public-content'

/**
 * Wraps a public read so its result is cached across requests and visitors.
 *
 * Logs `[cache] MISS <name>` every time the query actually runs, so Workers
 * logs show how often Supabase is really hit. A cache HIT runs nothing and
 * logs nothing; set NEXT_PRIVATE_DEBUG_CACHE=1 to see hits too.
 *
 * @param name - stable label, also part of the cache key; must be unique per query
 * @param fn - the query; must use `createPublicClient()` (no cookies) and must
 *   THROW on a Supabase error. A thrown error is never cached, so a hiccup
 *   doesn't freeze an empty result for every visitor; returning `[]` would.
 * @returns a function with the same signature; its arguments are part of the key
 */
export function cachedPublicQuery<Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return unstable_cache(
    async (...args: Args) => {
      const startedAt = Date.now()
      const result = await fn(...args)
      console.log(`[cache] MISS ${name} ${JSON.stringify(args)} ${Date.now() - startedAt}ms`)
      return result
    },
    ['public', name],
    { tags: [PUBLIC_CONTENT_TAG], revalidate: PUBLIC_REVALIDATE_SECONDS }
  )
}

/**
 * Throw this inside a cachedPublicQuery when the requested row doesn't exist.
 * It is thrown, not returned as null, so the miss is NOT cached: otherwise
 * every random slug a bot tries would add a cache entry to R2. Convert it
 * back to null at the call site with `nullIfNotFound`.
 */
export class PublicNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = 'PublicNotFoundError'
  }
}

/**
 * Awaits a cached query, turning PublicNotFoundError into null. Any other
 * error is rethrown.
 * @returns the query result, or null when the query reported "not found"
 */
export async function nullIfNotFound<T>(query: Promise<T>): Promise<T | null> {
  try {
    return await query
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null
    throw err
  }
}

/**
 * Purges every cached public page and query so the next visitor sees fresh
 * data. Every admin route that writes content a public page shows (series,
 * chapters, pages, posts, hero slides, settings, logo) must call it.
 *
 * Call it right after the admin check, not after the write. It only queues
 * the purge: Next applies queued purges once the handler has returned its
 * response (any status), so a single call also covers early returns and a
 * write that fails halfway after some rows already changed. A purge with
 * nothing to purge just costs one extra page render.
 *
 * Both calls expire immediately (no stale window): revalidatePath on the root
 * layout covers every page under it, and the tag covers cached queries even
 * on pages that render per request (e.g. /posts with ?type=).
 *
 * Never throws: the write already succeeded, so a purge failure must not turn
 * the admin's save into an error. It is logged loudly instead; worst case the
 * page refreshes on its own within PUBLIC_REVALIDATE_SECONDS.
 *
 * @param reason - short label for the logs, e.g. 'PATCH /api/chapters/[id]'
 */
export function revalidatePublicContent(reason: string): void {
  try {
    revalidatePath('/', 'layout')
    revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 })
    console.log(`[cache] PURGE public content (${reason})`)
  } catch (err) {
    console.error(`[cache] PURGE failed (${reason}):`, err)
  }
}
