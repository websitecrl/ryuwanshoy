# Ryuwanshoy

Comic / manhwa publishing site for a Filipino creator. Public reader side + protected admin dashboard. All chapters free to read.

**Live (pre-launch):** https://ryuwanshoy.testgmail050.workers.dev · `ryuwanshoy.com` connects at the November 2026 launch
**Admin:** `/admin`

Deeper docs live in [`docs/`](docs/README.md): architecture, caching, launch checklist. Where this file and the code disagree, the code wins.

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui, `--ryu-*` design tokens |
| DB + Auth | Supabase (Postgres + RLS, single admin account) |
| Image storage | Cloudflare R2 (signed requests with `aws4fetch`) |
| Hosting | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) |
| Caching | OpenNext R2 incremental cache + D1 tag cache + Durable Object queue |
| Monitoring | Cloudflare Workers Logs + Traces (no Sentry) |
| Rate limiting | Cloudflare Workers rate limit bindings |
| Donations | Ko-fi, Patreon, PayPal links (set in Admin → Settings) |

---

## Getting started

```bash
npm install
# create .env.local with the variables below (it is gitignored)
npm run dev
```

Open http://localhost:3000

```bash
npx tsc --noEmit   # type check (CI runs this)
npm run lint       # eslint (CI runs this)
npm run build      # production build
npm run preview    # build + run on the local Workers runtime
```

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only

# Admin: the Supabase auth user id of the one admin. Missing = every admin request is refused
ADMIN_USER_ID=

# Cloudflare R2 (server only). Endpoint and public URL are bare origins, no path
R2_ENDPOINT=                    # https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=                 # public comics bucket
R2_EA_BUCKET_NAME=              # private Early Access bucket
R2_PUBLIC_URL=                  # where the public bucket is served

# Early Access (disabled; only needed when it is turned on)
NEXT_PUBLIC_EARLY_ACCESS_ENABLED=false
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
MAILCHIMP_API_KEY=
MAILCHIMP_AUDIENCE_ID=
MAILCHIMP_SERVER_PREFIX=

# Site address, baked into the build (share images, sitemap, robots.txt)
NEXT_PUBLIC_SITE_URL=
```

`.env.local` is gitignored; never commit secrets. On the live Worker, server variables are **Worker secrets** (`npx wrangler secret list`). `NEXT_PUBLIC_*` values are baked in at build time, see Deploy.

---

## Routes

**Reader**

```
/                          Home (hero banner, latest releases, illustrations)
/comics                    All series
/comics/[slug]             Series detail, chapter list, comments
/comics/[slug]/[chapter]   Chapter reader (scroll / flip)
/posts                     Illustrations (?type= filter)
/bookmarks                 Saved series (stored in the browser)
/donate                    Donations
/feedback                  Bug report / feedback form
/early-access              Signup (disabled)
```

**Admin** (session refreshed in `src/middleware.ts`; every write route checks `requireAdmin()`)

```
/admin                     Login
/admin/dashboard           Overview, hero banner manager, quick create
/admin/series              Series list; /new is the create wizard
/admin/chapters            Chapters + page uploader
/admin/posts               Illustrations
/admin/drafts              Unpublished content
/admin/feedback            Feedback inbox
/admin/early-access        Signup list (only used when Early Access is on)
/admin/settings            Site info, donations, social links, Storage cleanup
/admin/help                Help
/admin/reset-password      Password reset
```

---

## Project structure

```
src/
├── app/
│   ├── (home)/, comics/, posts/, …   Reader pages (server components)
│   ├── admin/                        Admin dashboard
│   └── api/                          Route handlers
├── components/
│   ├── ui/          shadcn
│   ├── reader/      ScrollReader, FlipReader, PostModal, comments
│   ├── admin/       Sidebar, HeroBannerManager, StorageCleanup, DeleteButton
│   └── shared/      Navbar, Footer, AgeGate
├── hooks/           useComments, useSavedAge, useRyuTheme
├── lib/
│   ├── supabase/    client (browser), server (session), public (cached reads), admin (service role)
│   ├── cache/       public-cache: cached reads + purge on admin writes
│   ├── r2.ts        server-only R2 upload / list / delete
│   ├── image-compress.ts, page-files.ts   browser-side image shrinking and page uploads
│   ├── storage-cleanup.ts                 unused R2 file scan
│   └── validation.ts, api-errors.ts, format.ts, …
├── types/database.ts    Supabase generated types (never hand edit)
└── middleware.ts
supabase/                schema.sql + migrations (applied migrations are never edited)
```

---

## Database

Tables: `series`, `chapters`, `pages`, `posts`, `hero_slides`, `comments`, `likes`, `feedback`, `early_access`, `settings`.

RLS is on for every table: public read of published content, admin-only writes. Most writes go through API routes with the service role after `requireAdmin()`. The admin's user id is hardcoded in 23 policies, see `docs/admin-uuid-policies.md` before changing the admin account.

After **any** schema change, add a new migration file and regenerate types:

```bash
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

---

## Images

Images are shrunk **in the browser** (`src/lib/image-compress.ts`) before upload, so the Worker never processes a full size original (free plan CPU limit). The server checks the real file type (magic bytes) and stores the file in R2 under a fresh UUID key.

| Upload | Stored size | Format |
|---|---|---|
| Comic page | 1600 px tall; spreads (landscape) too, max 3200 wide | JPEG |
| Hero banner | 2200 px longest side | JPEG |
| Post / illustration | 1600 px longest side | JPEG, or PNG if it has transparent pixels |
| Series cover | 1280 px longest side | JPEG, or PNG if transparent |
| Logo | 800 px longest side | JPEG, or PNG if transparent |

Deleting content in the admin also deletes its R2 files. **Admin → Settings → Storage** finds and removes any files nothing uses (older than 24 hours).

---

## Conventions

- TypeScript strict, no `any`
- Colors come only from `--ryu-*` CSS variables (`src/app/globals.css`), checked in light and dark; no hex, `rgba()` or Tailwind color literals
- Every API route: auth check on mutations, input validation, typed JSON response, no raw database errors to the client
- Every async action: loading and error state; every list: empty state
- Commits: `feat:` / `fix:` / `style:` / `refactor:` / `docs:`
- Branches: `feat/*`, `fix/*`, … never push straight to `main`; PRs run tsc + lint in CI

---

## Deploy

Deploy is manual, from the `main` checkout:

```powershell
git checkout main
git pull
$env:NEXT_PUBLIC_SITE_URL = "https://ryuwanshoy.testgmail050.workers.dev"   # the live address
npm run deploy
```

Set `NEXT_PUBLIC_SITE_URL` in the shell first: the build reads `.env.local`, which has the localhost address. Afterwards check that `<live>/robots.txt` shows the live address. Cache details: `docs/caching.md` and `npm run cache:check`.

---

## Notes

- Early Access is **disabled** (`NEXT_PUBLIC_EARLY_ACCESS_ENABLED=false`). Admin can still tag chapters as EA; readers see nothing until it's turned on.
- Reader bookmarks, likes and reading progress use `localStorage`; there are no reader accounts.
- Readers get updates through the page cache, purged on every admin write. Realtime is admin only (notifications, drafts count).
- Readers pick an age band once (age gate); series above it show a "for N+ readers" screen.
