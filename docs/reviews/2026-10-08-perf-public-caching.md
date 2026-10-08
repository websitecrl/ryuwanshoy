# Review, perf/public-caching, 2026-10-08

**Reviewed by**: Sonnet 5.5 (author on Opus 5.5)
**Scope**: 29 files, branch vs origin/main (merge base c0da113)
**Verdict**: Approve with nits

## Summary
Moves every public Supabase read onto a cookie-less anon client wrapped in `unstable_cache` (60 s, one tag), makes `/` and `/comics` ISR, keeps series/reader HTML per-request via `connection()`, and purges via `revalidatePath('/', 'layout')` + `revalidateTag('public-content', { expire: 0 })` from every admin write route, backed by OpenNext R2 / DO queue / D1 tag cache. I checked the claims against Next 16.2 and OpenNext 1.20.2 source and they hold. No blockers or majors. Remaining issues are operational (build and deploy coupling), small staleness windows and a few behaviour changes worth knowing about. No automated tests exist for the project (`none-yet`); noted once, and the cache semantics are the kind of thing `/check verify` against `opennextjs-cloudflare preview` has to cover.

## Verified claims (against library source)
- `revalidateTag(tag, { expire: 0 })` is the valid Next 16 two-arg form (no deprecation warning). OpenNext turns `expire: 0` into `expire = now`, and the D1 `hasBeenRevalidated` check (`expire <= now && expire > lastModified`) then treats every older entry as revalidated. Works.
- Next queues `pendingRevalidatedTags` and `resolvePendingRevalidations()` runs after the handler returns a Response (success and redirect paths). So calling right after `requireAdmin()` covers 400/500 returns, and a 401 never reaches it (guard returns first), so an unauthenticated caller cannot trigger purges.
- `unstable_cache` skips the cache when `workStore.fetchCache === 'force-no-store'` (unstable-cache.js:146), which `force-dynamic` sets. Using `connection()` instead is correct.
- A throw inside the `unstable_cache` callback caches nothing (cacheNewResult only runs after success), and `PublicNotFoundError` survives as the same class (no serialization), so `nullIfNotFound` works.
- Cache key = `cb.toString()` + `['public', name]` + `JSON.stringify(args)`. Unknown slug/chapter throws so it is never stored; `/posts` `type` is whitelisted. Keys are bounded by real rows.
- `revalidatePath('/', 'layout')` produces the `_N_T_/layout` tag that every page carries as an implicit tag.
- `DOQueueHandler` is exported from OpenNext's worker template; `WORKER_SELF_REFERENCE` binding already exists; `new_sqlite_classes` is the right migration for the free plan; `populate-cache` creates the D1 `revalidations` table (and ALTERs in `stale`/`expire`).
- Every cached query uses `createPublicClient()` (anon). No cookie client remains on any cached path. The only remaining `supabase/server` users outside admin/api are `/bookmarks` (force-dynamic, per-user) and `require-admin`.
- Draft filtering is intact in code: series page filters `is_published && !is_draft` chapters, reader queries (chapter, prev, next, picker) filter both, home chapters filter both and `series.is_published`. RLS for anon only enforces `is_published`, so the in-code `is_draft` filters are the real protection and they were preserved.
- All DB writes go through `src/app/api/*`; `lib/drafts.ts` and `lib/series-covers.ts` are only called from routes that purge (`DELETE /api/drafts`, series routes). No server actions or client-side direct writes exist. `comments`, `likes`, `early-access`, `upload`, `r2-storage` do not change cached public content.

## Minor
### 🟡 Build now depends on a live Supabase, `src/app/page.tsx:8`, `src/app/comics/page.tsx:26`
**Problem**: `/` and `/comics` are now prerendered at build, and both queries throw on error by design. Previously `force-dynamic` meant the build never touched the DB. A paused free-tier project or a missing `NEXT_PUBLIC_SUPABASE_*` at build time now fails the build (or at best bakes in fallback layout settings, see the settings finding).
**Why it matters**: Deploys become coupled to DB availability, and the failure mode is a confusing prerender error.
**Suggested fix**: Document it in docs/caching.md (build env must have the Supabase vars and the project must be awake), or catch at build time and fall back to render-on-demand.

### 🟡 Purges silently do nothing if deployed without `opennextjs-cloudflare deploy`, `wrangler.jsonc:33`
**Problem**: The D1 `revalidations` table only exists after `populate-cache` runs. With a plain `wrangler deploy` or a Workers Builds default command, `writeTags` throws (caught and logged as `PURGE failed`) and `hasBeenRevalidated` swallows the missing table and returns false. Admin edits then only appear after up to 60 s, and nothing in the admin UI says so. There is no `deploy`/`preview` npm script pinning the right command.
**Suggested fix**: Add `deploy` and `preview` scripts to package.json (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`) and point the CI deploy command at them.

### 🟡 `getSettings` swallows errors, so a failure is baked into cached HTML, `src/lib/settings.ts:25`
**Problem**: `querySettings` correctly throws and is not cached, but `getSettings` catches it and returns `null`. When that happens during an ISR render of `/`, `/donate`, `/early-access` or the build, the HTML (no logo, default title, no social links) is stored and served for up to 60 s (revalidate is propagated from the `unstable_cache` call even on failure). This is exactly the "freeze an empty result" case the rest of the change works to avoid.
**Suggested fix**: Let the error propagate on ISR pages (a failed ISR regeneration keeps serving the previous good copy), keeping the null fallback only for per-request pages.

### 🟡 Each page upload triggers a full purge, `src/app/api/pages/route.ts:15`
**Problem**: `POST /api/pages` is called once per page, so a 40-page chapter does 40 purges (about 3 D1 writes each plus a cold cache for visitors each time).
**Suggested fix**: Acceptable at current scale. Consider purging once from the chapter-finalise step, or skipping the purge on page uploads for chapters that are still drafts.

### 🟡 Purge is skipped if a handler throws uncaught, `src/lib/cache/public-cache.ts:94`
**Problem**: The comment says a single early call covers "any response". `resolvePendingRevalidations()` is only called on the success and redirect paths in app-route/module.js; an uncaught throw rethrows before it. Most handlers wrap their body in try/catch, so this only matters where a write precedes an uncaught throw. Worst case is the 60 s fallback.
**Suggested fix**: Soften the comment, or confirm each write handler has its body fully inside try/catch.

### 🟡 `/comics` chapter count ignores `is_draft`, `src/app/comics/page.tsx:44`
**Problem**: The chapters query filters only `is_published`, so a chapter with `is_published = true, is_draft = true` inflates the count. Pre-existing (same query in `/bookmarks`), but now baked into a cached page. The pages count also changed meaning: it used to run as the visitor's role (admin saw all pages), now it is the anon count.
**Suggested fix**: Add `.eq('is_draft', false)`.

### 🟡 Sitemap now actually gets cached for an hour and is not purged, `src/app/sitemap.ts:3`
**Problem**: `revalidate = 3600` was previously ineffective (no incremental cache), so the sitemap rendered per request. With R2 incremental cache it now stays stale for up to 1 h after an unpublish/delete, and it is not under the `_N_T_/layout` tag so `revalidatePublicContent` does not clear it. It uses the service-role client but filters published/non-draft, so there is no leak, just a stale URL.
**Suggested fix**: Note it in docs, or `revalidatePath('/sitemap.xml')` in the purge helper.

### 🟡 Series and reader pages do 2 R2 reads plus 2 D1 reads per view instead of 2 Supabase reads, `src/app/comics/[slug]/page.tsx:137`
**Problem**: Each `unstable_cache` hit costs an R2 get and a D1 tag lookup. The change cuts Supabase load and egress, but latency on these two routes may not improve much. Worth confirming with the `cache:check` timings and Workers CPU stats on the 10 ms plan.
**Suggested fix**: Measure after deploy; no code change needed if timings are fine.

## Nits
- ⚪ `cloudflare-env.d.ts:5`, hand-edited but the header still claims a wrangler-generated hash. Regenerate with `npm run cf-typegen`.
- ⚪ `src/app/comics/[slug]/page.tsx` and `[chapter]/page.tsx`, `.single()` to `.maybeSingle()` plus throw-on-error means a transient Supabase error now shows the error page where it used to return notFound. Intentional and arguably better; worth a line in the PR description.
- ⚪ `src/lib/cache/public-cache.ts:136`, cache key includes `cb.toString()`, which is identical for every query (the shared wrapper), so uniqueness rests entirely on `name`. The doc comment says so; consider a dev-time duplicate-name assertion.
- ⚪ R2 cache objects are keyed per build id and never expire; consider an R2 lifecycle rule so old builds do not accumulate.
- ⚪ `scripts/cache-check.mjs:175`, sending `cache-control: no-cache` can make intermediaries bypass cache; harmless against the Worker but misleading.

## Strengths
- Safety is structural: the anon client means cached output cannot contain admin-only rows, errors and not-found are never cached, and the in-code `is_draft` filters were kept rather than relying on RLS.
- Revalidation design checked against Next 16 semantics (pending revalidation timing, `force-no-store` interaction, `expire: 0`), with unusually clear comments and a doc (`docs/caching.md`) plus a `cache:check` script for observing it.
- Complete coverage of write routes; the purge helper never throws, so a purge failure cannot fail an admin save.

## Test coverage
No test runner or convention exists (none-yet), so correctness findings were weighed more heavily. Nothing in this change is covered by automated tests; the cache and purge behaviour in particular needs verifying end to end (`opennextjs-cloudflare preview`, then a save in admin followed by a reload of `/`, `/comics`, a series page and a reader page).
