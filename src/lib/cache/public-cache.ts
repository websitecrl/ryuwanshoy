import 'server-only'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

// safety net if a write forgot to purge. pages repeat the literal (Next rejects imports)
export const PUBLIC_REVALIDATE_SECONDS = 60

// one tag -> purge everything (one admin, renamed slugs never missed)
export const PUBLIC_CONTENT_TAG = 'public-content'

/** cachedPublicQuery -> key: name + args -> MISS runs fn (anon client, must throw on error) -> errors never cached */
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

/** missing row -> throw (misses not cached) -> nullIfNotFound -> null */
export class PublicNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = 'PublicNotFoundError'
  }
}

/** PublicNotFoundError -> null */
export async function nullIfNotFound<T>(query: Promise<T>): Promise<T | null> {
  try {
    return await query
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null
    throw err
  }
}

/** admin write -> call after the admin check -> purge after the response (any status; uncaught throw skips it). never throws */
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
