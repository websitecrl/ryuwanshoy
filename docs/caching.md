# Caching (public pages)

How public pages are cached on Cloudflare, and how to see what the cache is doing.

## What is cached

| Route | HTML | Supabase data | Refresh |
|---|---|---|---|
| `/`, `/comics`, `/donate`, `/early-access` | cached (ISR) | cached | 60 s, or right away on admin save |
| `/comics/[slug]`, `/comics/[slug]/[chapter]` | rendered per request | cached | 60 s, or right away on admin save |
| `/posts` (and `?type=`) | rendered per request | cached per type | 60 s, or right away on admin save |
| `/sitemap.xml` | cached | (read inside the route) | 1 h, or right away on admin save |
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

**Changing what a cached query returns?** (a new column, a renamed field) Bump its name, e.g.
`'comics:chapter'` to `'comics:chapter:v2'`. The name is part of the cache key, and the key doesn't
change with the code, so without a bump an old result missing the new field can be served for up
to 60 s (and locally, until the cache is cleared).

## Infra (OpenNext)

`open-next.config.ts` + `wrangler.jsonc`:

- R2 bucket `ryuwanshoy-opennext-cache`: the cached pages and query results.
- Durable Object `DOQueueHandler`: runs the background 60 s refresh.
- D1 `ryuwanshoy-opennext-tag-cache`: records admin purges. Its table is created by
  `opennextjs-cloudflare deploy`, so **always deploy with `npm run deploy`**. With a plain
  `wrangler deploy` the table is missing, purges silently do nothing, and admin changes take up to
  60 s to show.

Caching only works in a deployed build or `npm run preview` (local Cloudflare runtime). `next dev`
never caches.

**The build needs Supabase.** `/` and `/comics` are prerendered at build time, so the build must
have the `NEXT_PUBLIC_SUPABASE_*` env vars and the Supabase project must be awake (a paused
free-tier project fails the build with a prerender error).

**Known 60 s windows** (no fix needed, just know them): if a settings read fails, pages that only
read settings through the layout (e.g. `/donate`) can show the default title for up to 60 s; and if
an admin route throws an uncaught error, its purge is skipped and the change shows up after 60 s.

**Never run an OpenNext build in a git worktree whose `node_modules` is linked to the main
checkout.** OpenNext patches files inside `next/dist` and that breaks `next dev` for the main
checkout. Fix: `npm ci`.

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
