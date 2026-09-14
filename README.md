# Ryuwanshoy

Comic / manhwa publishing site for a Filipino creator. Public reader side + protected admin dashboard. All chapters free to read.

**Live:** _TBD_
**Admin:** `/admin`

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| DB + Auth | Supabase |
| Image storage | Cloudflare R2 (S3 SDK + sharp) |
| Hosting | Cloudflare Pages (OpenNext) |
| Monitoring | Sentry |
| Email list | Mailchimp |
| Donations | Ko-fi + GCash QR |

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Open http://localhost:3000

```bash
npm run build      # production build
npm run lint       # eslint
npm run preview    # OpenNext / Cloudflare preview
```

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Mailchimp
MAILCHIMP_API_KEY=
MAILCHIMP_AUDIENCE_ID=
MAILCHIMP_SERVER_PREFIX=

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=

# Feature flags
NEXT_PUBLIC_EARLY_ACCESS_ENABLED=false

# Site
NEXT_PUBLIC_SITE_URL=
```

`.env.local` is gitignored. Never commit secrets. `SUPABASE_SERVICE_ROLE_KEY` and all `R2_*` keys are **server-only** — never import them into a client component.

---

## Routes

**Reader**

```
/                          Home
/comics                    All series
/comics/[slug]             Series detail + chapter list
/comics/[slug]/[chapter]   Chapter reader (scroll / flip)
/posts                     Sketchbook
/donate                    Donations
/early-access              Signup
```

**Admin** (all behind `middleware.ts` + Supabase Auth)

```
/admin                     Login
/admin/dashboard           Overview + hero banner manager
/admin/series              Series CRUD
/admin/chapters            Chapter CRUD + page uploader
/admin/posts               Posts CRUD
/admin/drafts              Unpublished content
/admin/early-access        Email list + CSV export
/admin/settings            Site settings
```

---

## Project structure

```
src/
├── app/
│   ├── (reader pages)
│   ├── admin/           Protected dashboard
│   └── api/             Route handlers
├── components/
│   ├── ui/              shadcn
│   ├── reader/          ScrollReader, FlipReader, toggle
│   ├── admin/           Sidebar, HeroBannerManager, PageUploader
│   └── shared/          Navbar, Footer
├── lib/
│   ├── supabase.ts      Browser + SSR clients
│   ├── r2.ts            Server-only upload helper
│   └── utils.ts
├── types/database.ts    Supabase generated types
└── middleware.ts        Guards /admin/*
supabase/                Migrations + policies
```

---

## Database

Tables: `series`, `chapters`, `pages`, `posts`, `hero_slides`, `early_access`, `settings`.

RLS: public read on content tables, admin write. `early_access` is public insert, admin read/delete.

After **any** schema change, regenerate types:

```bash
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

---

## Images

All uploads go through an API route → `sharp` (WebP, 85%, max 1200px) → R2. Client components never touch the S3 SDK.

```
Series cover    460 × 640   portrait
Hero banner     1280 × 480  landscape min
Comic page      2550 × 3300 original, 25MB max
Post image      any size
```

---

## Conventions

- TypeScript strict, no `any`
- Colors come only from `--ryu-*` CSS variables — no hardcoded hex or Tailwind color literals
- Every API route: auth check on mutations, typed JSON response, error handling
- Every async action: loading state; every list: empty state
- Commits: `feat:` / `fix:` / `chore:`
- Branches: `feature/*`, `fix/*` — never push straight to `main`

---

## Deploy

Pushes to `main` build to Cloudflare Pages via OpenNext. Env vars are set in the Cloudflare Pages dashboard, not in the repo.

---

## Notes

- Early Access is **disabled** (`NEXT_PUBLIC_EARLY_ACCESS_ENABLED=false`). Admin can still tag chapters as EA; readers see nothing until it's flipped on.
- Reader bookmarks use `localStorage` — no reader accounts.
- Realtime: admin publishes → readers see it without refresh (Supabase WebSocket).