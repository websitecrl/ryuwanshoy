# Caching (public pages)

How public pages are cached on Cloudflare, and how to see what the cache is doing.

## What is cached

| Route | HTML | Supabase data | Refresh |
|---|---|---|---|
| `/`, `/comics`, `/donate`, `/early-access` | cached (ISR) | cached | 60 s, or right away on admin save |
| `/comics/[slug]`, `/comics/[slug]/[chapter]` | rendered per request | cached | 60 s, or right away on admin save |
| `/posts` (and `?type=`) | rendered per request | cached per type | 60 s, or right away on admin save |
| `/admin/*`, `/api/*`, `/bookmarks` | not cached | not cached | |

All public reads go through `cachedPublicQuery` in `src/lib/cache/public-cache.ts` and use
`createPublicClient()` from `src/lib/supabase/public.ts` (anon role, no cookies). Because it never
uses the visitor's session, a draft can't end up in a cached page even when an admin triggers the refresh.

Every admin write route calls `revalidatePublicContent()` right after the admin check. It purges all
cached pages and queries; the next visitor gets a fresh render.

**Adding a new admin write route?** Call `revalidatePublicContent('<METHOD> <path>')` after
`requireAdmin()`. Without it, the change shows up only after the 60 s refresh.

**Adding a new public read?** Wrap it in `cachedPublicQuery`, use `createPublicClient()`, and throw
on a Supabase error (never return `[]`/`null` for an error, or the empty result gets cached).

## Infra (OpenNext)

`open-next.config.ts` + `wrangler.jsonc`:

- R2 bucket `ryuwanshoy-opennext-cache`: the cached pages and query results.
- Durable Object `DOQueueHandler`: runs the background 60 s refresh.
- D1 `ryuwanshoy-opennext-tag-cache`: records admin purges. Its table is created by
  `npx opennextjs-cloudflare deploy`, so always deploy with that command.

Caching only works in a deployed build or `npx opennextjs-cloudflare preview`. `next dev` never caches.

## Watching the cache

**1. Response header.** Cached pages send `x-nextjs-cache: HIT | STALE | MISS`.

```bash
npm run cache:check -- https://<your-site> / /comics /comics/<slug>/1
```

Each path is requested twice. Expect `HIT` (or `STALE` right after the 60 s window) on the
2nd request for `/` and `/comics`. `-` means the page renders per request (expected for the series,
reader and posts pages; their data is still cached). On Git Bash, prefix with `MSYS_NO_PATHCONV=1`
so `/comics` isn't rewritten into a Windows path.

**2. Workers logs** (dashboard → Workers → ryuwanshoy → Logs, or `npx wrangler tail`):

- `[cache] MISS <query> <args> <ms>`: the query really ran against Supabase. Few of these = cache working.
- `[cache] PURGE public content (<route>)`: an admin save cleared the cache.
- `[cache] PURGE failed`: the purge failed; content refreshes on its own within 60 s.

**3. Full debug logs** (every cache get/set/tag check; noisy, turn off after):

```bash
npx wrangler secret put NEXT_PRIVATE_DEBUG_CACHE   # enter 1
npx wrangler secret delete NEXT_PRIVATE_DEBUG_CACHE
```
