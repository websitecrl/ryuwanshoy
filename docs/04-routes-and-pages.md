# 4. Routes & pages

All routes use the Next.js App Router under `src/app/`. Dynamic params are `Promise`s in Next 16 (`const { slug } = await params`).

## Public routes

| URL | File | Rendering | Data source | Notes |
|-----|------|-----------|-------------|-------|
| `/` | `app/page.tsx` → `(components)/HomeClient.tsx` | ISR 60 s | Hero slides, latest 6 published chapters (of published series), latest 4 posts, settings | Realtime refresh; age-filtered; see below |
| `/comics` | `app/comics/page.tsx` → `components/admin/reader/SeriesGrid.tsx` | ISR 60 s | Published series, chapter counts, total page count | Filters, sort, search, age filter |
| `/comics/[slug]` | `app/comics/[slug]/page.tsx` | dynamic | Series + published chapters with `pages(count)` | `notFound()` if unpublished |
| `/comics/[slug]/[chapter]` | `app/comics/[slug]/[chapter]/page.tsx` → `ReaderShell` | dynamic | Series, chapter, pages, prev/next, chapter list | No Navbar/Footer |
| `/posts` | `app/posts/page.tsx` → `(components)/PostsClient.tsx` | ISR 60 s | `posts`, optional `?type=` filter | Realtime; opens `PostModal` |
| `/bookmarks` | `app/bookmarks/page.tsx` → `BookmarksGrid` | dynamic | Published series + chapter counts | Filters by ids from `localStorage` |
| `/donate` | `app/donate/page.tsx` | client | `GET /api/settings` | Ko-fi card, FAQ, empty state |
| `/early-access` | `app/early-access/page.tsx` | client | `GET /api/settings`, `POST /api/early-access` | Redirects to `/` unless the flag is `"true"` |
| `/sitemap.xml` | `app/sitemap.ts` | ISR 1 h | Series + chapters | Static pages + every published series and chapter |
| `/robots.txt` | `app/robots.ts` | static | — | Allows `/`, disallows `/admin`, `/api/`; links the sitemap |

### `/` Home

Server work in `page.tsx`, in parallel (`Promise.all`): `getHeroSlides`, `getLatestChapters`, `getRecentPosts`, `getSettings`. `generateMetadata` reads `site_title`, `site_description`, `logo_url` from settings (fallbacks: *Ryuwanshoy*, *A Filipino webcomic by Ryu*, `/og-default.png`).

`HomeClient` composes: `HeroBanner` (auto-advances every 6.5 s), `ContinueReading` (from `localStorage.continueReading`), `LatestReleases`, `SketchbookPreview`, the creator section and a support card. It reads `ryu-age` and drops slides/chapters whose series `min_age` (default 13 when null) exceeds the reader's age. It subscribes to Realtime on `chapters`/`series`/`hero_slides` and on `posts`.

### `/comics/[slug]` Series detail

Composition: `SeriesHeader` (cover, status/genre badges, START READING or `CONTINUE — CH. n`, RESTART, BOOKMARK, SHARE, optional SUBSCRIBE when EA is enabled) → `ChapterList` (Chapters/About tabs, sort asc/desc, per-row state `unread | reading | read`, `ContinueReadingBar` above the tabs) → `SeriesComments` (series-level comments).

Only chapters with `is_published = true` are passed to the client; drafts are filtered server-side. `generateMetadata` produces Open Graph/Twitter cards (cover as image, else `/og-default.png`).

### `/comics/[slug]/[chapter]` Reader

`chapter` is parsed with `parseInt`; NaN → 404. The chapter must be `is_published = true` **and** `is_draft = false`. Pages are read with the **service-role** client, ordered by `page_number`. Also fetched: previous/next published chapter and the full chapter list for the picker. A chapter with zero pages renders "This chapter has no pages yet." See [Reader & client state](./11-reader-and-client-state.md) for behaviour.

### Layout chrome per route

`ConditionalLayout` (client) uses `usePathname()`:

| Pathname | Navbar | Footer |
|----------|:------:|:------:|
| `/admin…` | no | no |
| `/comics/<slug>/<chapter>` (regex `^/comics/[^/]+/[^/]+`) | no | no |
| everything else | yes | yes |

Navbar links: **Home**, **Comics**, **Illustrations** (`/posts`), a bookmarks link with count badge, a **theme toggle**, and a **Support** button (`/donate`). Footer links: Home, Comics, Illustrations, Support, plus social icons (a platform appears only if its URL is set in settings).

## Admin routes

All under `src/app/admin/`. `admin/layout.tsx` calls `auth.getUser()`; with no user it renders only `{children}` (the login page, no sidebar), otherwise the sidebar shell.

| URL | File | Type | Purpose | APIs used |
|-----|------|------|---------|-----------|
| `/admin` | `admin/page.tsx` | client | Login (email + password). Redirects to dashboard when already signed in. | Supabase Auth |
| `/admin/reset-password` | `admin/reset-password/page.tsx` | client | Two modes: *request* (send email) and *update* (after recovery link, set new password) | Supabase Auth |
| `/admin/dashboard` | `admin/dashboard/page.tsx` | server | Published series preview (6), draft chapters (5), draft series (5), `HeroBannerManager`, `DashboardQuickCreate`, `NotificationBell` | session client; hero-slides APIs |
| `/admin/series` | `admin/series/page.tsx` | client | Series cards with filter pills, delete dialog | `/api/series`, `/api/series/[id]` |
| `/admin/series/new` | `admin/series/new/page.tsx` | client | 3-step wizard (details → pages → review) | `/api/series`, `/api/chapters`, `/api/pages`, `/api/series/[id]`, `/api/chapters/[id]` |
| `/admin/series/[id]` | `admin/series/[id]/page.tsx` | client | Edit series (title, slug, description, genre, status, min age, cover) | `/api/series/[id]` |
| `/admin/chapters` | `admin/chapters/page.tsx` | client | Table of **published** chapters; delete | `/api/chapters/all`, `/api/chapters/[id]` |
| `/admin/chapters/new` | `admin/chapters/new/page.tsx` | client | Pick series, chapter #, title, drag-sortable page uploads, save as draft or publish | `/api/series`, `/api/series/[id]`, `/api/chapters`, `/api/pages` |
| `/admin/chapters/[id]` | `admin/chapters/[id]/page.tsx` | client | Edit metadata, EA toggle (only if flag on), publish checklist, `PageUploader`, delete | `/api/chapters/[id]`, `/api/pages…` |
| `/admin/posts` | `admin/posts/page.tsx` | client | Illustration list; delete | `/api/posts`, `/api/posts/[id]` |
| `/admin/posts/new` | `admin/posts/new/page.tsx` | client | Create illustration (image ≤1600 px, original format kept) | `/api/posts` |
| `/admin/posts/[id]` | `admin/posts/[id]/page.tsx` | client | Edit/replace image/delete | `/api/posts/[id]` |
| `/admin/drafts` | `admin/drafts/page.tsx` | server | Draft series and draft chapters with completeness checklists; bulk and per-row delete | session client; `/api/drafts` |
| `/admin/early-access` | `admin/early-access/page.tsx` | client | Signup list, delete, **Export CSV** (`early-access-emails.csv`). Sidebar link only shown when the flag is on. | `/api/early-access` |
| `/admin/settings` | `admin/settings/page.tsx` | client | Sections: *The basics*, *Reader support*, *Where to find you*, *Reward your supporters* (EA only), *Admin account* | `/api/settings`, `/api/upload-logo`, Supabase Auth |
| `/admin/help` | `admin/help/page.tsx` | server (static) | Help center: what each Settings field does | none |

The sidebar (`components/admin/Sidebar.tsx`) lists **Dashboard, Series, Chapters, Illustration, Drafts, Settings**, an **Early Access** entry (flag-dependent), a draft-count badge (`/api/drafts`), the R2 storage meter (`/api/r2-storage`), the site logo/title (`/api/settings`, refreshed by a window `settings-updated` event) and a sign-out button.

## Middleware rules (`src/middleware.ts`)

Matcher: `/admin`, `/admin/:path*`, `/api/early-access`, `/api/early-access/:path*`, `/api/settings`.

| Condition | Result |
|-----------|--------|
| Admin API (`/api/early-access*` with method ≠ `POST`, or `/api/settings` `PATCH`) and no user | `401 {"error":"Unauthorized"}` |
| `/admin/*` (except `/admin` and `/admin/reset-password*`) and no user | redirect → `/admin` |
| `/admin` and a user exists | redirect → `/admin/dashboard` |
| otherwise | continue (session cookies refreshed) |

Middleware only proves "some user is signed in". The stricter "is *the* admin" check is `requireAdmin()` in each handler. See [Auth & security](./09-auth-and-security.md).

> Next.js 16 logs *"The 'middleware' file convention is deprecated. Please use 'proxy' instead."* The file still works; see [Known issues](./14-known-issues-and-roadmap.md).

## Adding a new page — checklist

1. Create `src/app/<route>/page.tsx` (server component by default).
2. Decide rendering: `export const revalidate = N` for ISR, `dynamic = 'force-dynamic'` for per-request data.
3. Public data → session client (needs an anon-readable RLS policy) or service client (server only).
4. Add `generateMetadata` for anything indexable; add the URL to `sitemap.ts` if it should be crawled.
5. If it needs the Navbar/Footer suppressed, extend the regex in `ConditionalLayout`.
6. Colours only from `--ryu-*` tokens — see [Design system](./08-design-system.md).
