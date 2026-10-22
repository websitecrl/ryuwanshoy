import 'server-only'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

// Safety net for a write path that forgot to purge. Page files repeat the literal: Next rejects imported values.
export const PUBLIC_REVALIDATE_SECONDS = 60

// One tag for every public read: purge-everything is cheap with one admin and can't miss a renamed slug.
export const PUBLIC_CONTENT_TAG = 'public-content'

/**
 * Caches a public read across requests (key: name + args). Logs `[cache] MISS <name>` when it runs.
 * fn must use createPublicClient() and THROW on a Supabase error, so a failure is never cached.
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

/** Throw for a missing row: thrown misses aren't cached, so bots can't fill R2. Convert with nullIfNotFound. */
export class PublicNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = 'PublicNotFoundError'
  }
}

/** Awaits a cached query, turning PublicNotFoundError into null. */
export async function nullIfNotFound<T>(query: Promise<T>): Promise<T | null> {
  try {
    return await query
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null
    throw err
  }
}

/**
 * Purges every cached public page and query. Call it in every admin write route, right after the admin check.
 * Next applies it once the handler returns (any status), so early returns are covered; an uncaught throw skips it.
 * Never throws; if the purge fails, pages refresh within PUBLIC_REVALIDATE_SECONDS.
 */
export function revalidatePublicContent(reason: string): void {
  try {
    revalidatePath('/', 'layout')
    revalidatePath('/sitemap.xml')
    revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 })
    console.log(`[cache] PURGE public content (${reason})`)
  } catch (err) {
    console.error(`[cache] PURGE failed (${reason}):`, err)
  }
}
