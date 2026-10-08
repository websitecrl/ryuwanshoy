// Shows whether public pages are served from the cache.
//
// Usage:
//   node scripts/cache-check.mjs [baseUrl] [path ...]
//   npm run cache:check -- https://ryuwanshoy.com /comics /comics/my-series/1
//
// Each path is requested twice. On a working setup the 2nd request says HIT
// (or STALE while a background refresh runs) and is noticeably faster.
// MISS on both = the page is not cacheable: something made it dynamic
// (cookies(), headers(), searchParams, force-dynamic) or the cache bindings
// are missing. "-" = no cache header at all (a dynamic page, e.g. /posts).
//
// Note: this only works against a deployed build (`npx opennextjs-cloudflare
// preview` or production). `next dev` never caches.

const [baseUrl = 'http://localhost:8787', ...extraPaths] = process.argv.slice(2)
const paths = extraPaths.length > 0 ? extraPaths : ['/', '/comics', '/posts']

/**
 * Fetches one URL and returns the cache-relevant parts of the response.
 * @param {string} url
 * @returns {Promise<{status: number, cache: string, age: string, ms: number}>}
 */
async function probe(url) {
  const startedAt = performance.now()
  const res = await fetch(url, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } })
  await res.arrayBuffer() // time the full body, not just headers
  return {
    status: res.status,
    // x-nextjs-cache is set by Next on ISR pages; x-opennext-cache by
    // OpenNext's cache interception when enabled.
    cache: res.headers.get('x-nextjs-cache') ?? res.headers.get('x-opennext-cache') ?? '-',
    age: res.headers.get('age') ?? '-',
    ms: Math.round(performance.now() - startedAt),
  }
}

for (const path of paths) {
  const url = new URL(path, baseUrl).toString()
  try {
    const first = await probe(url)
    const second = await probe(url)
    console.log(
      `${path.padEnd(32)} ${String(first.status).padEnd(4)}` +
        ` 1st=${first.cache.padEnd(6)} ${String(first.ms).padStart(5)}ms` +
        ` 2nd=${second.cache.padEnd(6)} ${String(second.ms).padStart(5)}ms` +
        ` age=${second.age}`
    )
  } catch (err) {
    console.log(`${path.padEnd(32)} ERROR ${err instanceof Error ? err.message : err}`)
  }
}
