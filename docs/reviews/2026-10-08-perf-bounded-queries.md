# Review, perf/bounded-queries, 2026-10-08

**Reviewed by**: Sonnet 5.5 (author on Opus 5.5)
**Scope**: 11 files, branch vs origin/main
**Verdict**: Approve with nits

## Summary
Adds cursor paging for /posts (first page cached, "Load more" via GET /api/posts) and for comments (30 top-level + all their replies, shared useComments hook), and moves /comics chapter counts into the DB. The cursor round-trips correctly (columns are `timestamp without time zone`, so the regex matches what PostgREST returns), the limit+1 trick is right, ?all=1 is admin-gated before any query, and no draft/unpublished leak was found. No blockers or majors; a handful of latent edge cases in useComments and data-dependent count drift. No test runner exists (none-yet); comment paging and reply grouping were never exercised with data, so `/check verify` should seed more than 30 comments with replies.

## Minor
### 🟡 loadingOlder can stick at true after a reload, `src/hooks/useComments.ts:112-118`
**Problem**: `reload()` bumps `generation`, but `loadOlder`'s `finally` only clears `loadingOlder` when the generation still matches. A reload or target change mid-load leaves `loadingOlder` true; "Show older" stays disabled and `loadOlder` early-returns.
**Why it matters**: Latent today (reload is only reachable from the error state; PostModal remounts per post), but the hook claims to support target changes.
**Suggested fix**: Reset `loadingOlder` inside `reload()`, or clear it unconditionally in `finally`.

### 🟡 add() silently drops comments while loading or in error state, `src/hooks/useComments.ts:121-128`
**Problem**: `add` returns `prev` unless status is `loaded`. PostModal's input is usable during "Loading comments..."; a comment posted then is saved (token stored, toast shown) but never displayed, and the in-flight first fetch may predate it.
**Suggested fix**: Disable the input until loaded, or refetch/queue the add.

### 🟡 total can disagree with what is visible, `src/app/api/comments/route.ts:101-108`
**Problem**: `total` counts every comment on the target, but the list shows only top-level comments and replies of those. Any legacy reply-to-reply (parent is itself a reply) or orphan is counted but never shown.
**Suggested fix**: Check prod data for nested replies; otherwise count top-level plus replies of top-level only.

### 🟡 Non-uuid ids reach Postgres and return 500 with raw message, `src/app/api/comments/route.ts:180-190`
**Problem**: `parent_id` is only checked to be a string, then used in `.eq('id', ...)`; a non-uuid gives a 22P02 error returned as 500 with `error.message`. Same pre-existing pattern for series_id/post_id in isPublicTarget.
**Suggested fix**: Validate uuid shape, return 400.

### 🟡 NULL created_at ends pagination silently, `src/app/api/posts/route.ts:50-57`, `src/app/posts/page.tsx:52`
**Problem**: Postgres sorts NULLs first in DESC and `.lt()` excludes NULLs; if the last row of a page has null created_at, `nextCursor` becomes null although more exist. Column is nullable but defaults to now(), so unlikely.
**Suggested fix**: Optional: filter out null created_at or accept and document.

### 🟡 Replies are not bounded, `src/app/api/comments/route.ts:130-139`
**Problem**: Replies for the 30 parents are fetched with no limit; PostgREST max-rows (default 1000) would silently truncate a very hot thread.
**Suggested fix**: Cap replies per parent/page, or document the limit.

### 🟡 Cached /comics shape changed under the same key, `src/app/comics/page.tsx:31`
**Problem**: `comics:index` now returns `{series, chapterCounts, pagesCount}` instead of `{series, chapters, pagesCount}`. If a pre-deploy entry survives in the incremental cache (depends on OpenNext build-id key prefix; not verified), `Object.values(undefined)` throws until revalidated.
**Suggested fix**: Rename the key (e.g. `comics:index:v2`) or default `chapterCounts ?? {}`.

### 🟡 Scroll jump when loading older in PostModal, `src/components/reader/PostModal.tsx:787-815`
**Problem**: Older comments are prepended above the viewport; browsers without scroll anchoring (Safari) will jump.
**Suggested fix**: Preserve scrollTop delta after the prepend.

## Nits
- ⚪ `src/app/api/comments/route.ts:149`, `await req.json()` is still unguarded (pre-existing); invalid JSON throws.
- ⚪ `src/hooks/useComments.ts:115`, `loadOlder` depends on whole `state`, so it is recreated every render; a ref would be simpler. A fast double click is saved only by the dedupe set.
- ⚪ `src/lib/posts.ts:4`, `POST_TYPES` is exported but only used inside the file.
- ⚪ `src/components/reader/PostModal.tsx:857`, hex colors (`#dc2626`, `#fff`, `#f43f5e`) violate the --ryu-* rule (pre-existing).
- ⚪ `src/app/api/comments/route.ts` header comment, equal-timestamp straddling on `.lt()` also applies to posts; fine for single-insert writes.

## Strengths
- Cursor is regex-validated before reaching a filter and round-trips with the `timestamp without time zone` format; limit+1 gives exact hasMore without a count query.
- ?all=1 is gated by requireAdmin before querying; reply parent validation (top-level, same target) and series XOR post are tight; generation counter guards stale responses; dedupe on append; chapters(count) without !inner keeps zero-chapter series; DB cascade on parent_id confirmed in schema.sql so local remove matches.

## Test coverage
No test runner (none-yet). Comment paging, reply grouping and the "Show older" flows are untested with data; `/check verify` should seed over 30 comments with replies on a series and on a post.

## Author follow-up (same branch)
- Fixed: `loadingOlder` is reset in `reload()` (useComments).
- Fixed: posting a new comment is disabled until the thread has loaded (SeriesComments, PostModal button and Enter key).
- Fixed: `series_id`, `post_id` and `parent_id` must be uuids, so a malformed id is a clean 400 instead of a 500 with the DB message. Invalid JSON on POST is a clean 400.
- Fixed: `/comics` cache key renamed to `comics:index:v2`.
- Fixed: PostModal keeps the scroll position when "Show older" prepends comments.
- Accepted and documented in `src/app/api/comments/route.ts`: total including legacy nested replies, NULL `created_at`, and replies above PostgREST max-rows. None can happen with current data and rules (POST now rejects nested replies).
- Re-verified against the real DB through `next dev`: 26/26 checks pass (3 new: non-uuid id, non-uuid parent, invalid JSON). Clean `next build`, `tsc` and ESLint.
