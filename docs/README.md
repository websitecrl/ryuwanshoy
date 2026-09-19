# Ryuwanshoy — Project Documentation

Documentation for the **Ryuwanshoy** webcomic site: a public reader for a Filipino creator's comics and illustrations, plus a private admin dashboard for publishing them.

These docs were written from the code as it exists in the repository (Next.js 16 / React 19 / Supabase / Cloudflare Workers via OpenNext). Where the older root `README.md` disagrees with the code, **the code wins** — see [14 – Known issues](./14-known-issues-and-roadmap.md) for the list of differences.

## Reading order

| # | Doc | Read it when you want to… |
|---|-----|---------------------------|
| 1 | [Overview](./01-overview.md) | Understand what the product is, its stack, features and vocabulary |
| 2 | [Getting started](./02-getting-started.md) | Set up a machine, fill in environment variables, run the app |
| 3 | [Architecture](./03-architecture.md) | Understand how a request flows, and why the code is shaped the way it is |
| 4 | [Routes & pages](./04-routes-and-pages.md) | Find which file renders a URL and where its data comes from |
| 5 | [API reference](./05-api-reference.md) | Call or change any `/api/*` endpoint |
| 6 | [Database](./06-database.md) | See tables, columns, relationships and the type-generation workflow |
| 7 | [Components & libraries](./07-components.md) | Locate a component, hook or `lib/` module |
| 8 | [Design system](./08-design-system.md) | Style anything: tokens, dark mode, buttons, conventions |
| 9 | [Auth & security](./09-auth-and-security.md) | Understand admin auth, rate limiting, headers, anonymous identity |
| 10 | [Storage & images](./10-storage-and-images.md) | Understand R2 buckets, upload flow and the image pipeline |
| 11 | [Reader & client state](./11-reader-and-client-state.md) | Understand the chapter reader and every `localStorage` key |
| 12 | [Admin guide](./12-admin-guide.md) | Learn the dashboard workflows (publishing, drafts, banners, settings) |
| 13 | [Deployment & operations](./13-deployment-and-operations.md) | Build, deploy, monitor and troubleshoot |
| 14 | [Known issues & roadmap](./14-known-issues-and-roadmap.md) | See verified bugs, gaps and suggested next steps |
| 15 | [Project history](./15-project-history.md) | See how the project evolved (from git history) |

## Quick facts

- **Repo:** single Next.js app (`src/`), no monorepo.
- **Package name:** `ryuwanshoy` · **Version:** `0.1.0` · **Commits:** 48 at the time of writing.
- **Public site:** home, comics, series detail, chapter reader, illustrations ("posts"), bookmarks, donate, early access.
- **Admin:** `/admin` — Supabase email/password login, single admin identified by `ADMIN_USER_ID`.
- **Data:** Supabase Postgres (tables: `series`, `chapters`, `pages`, `posts`, `hero_slides`, `comments`, `likes`, `early_access`, `settings`, `rate_limits`).
- **Files:** Cloudflare R2 — a public bucket for images and a private bucket reserved for Early Access pages.
- **Hosting:** Cloudflare Workers through `@opennextjs/cloudflare`.
- **No reader accounts** — bookmarks, progress, age, theme and comment ownership all live in the reader's browser (`localStorage`).

## Conventions used in these docs

- File paths are relative to the repository root, e.g. `src/lib/r2.ts`.
- `*` after a field name means *required*.
- "Admin" means the request passes `requireAdmin()` (see [Auth & security](./09-auth-and-security.md)).
- Nothing in these docs contains secrets. Environment variables are listed by **name only**.
- Statements about behaviour describe what the code does today; anything inferred rather than verified is labelled as such.

## Maintaining these docs

Update the relevant file in the same change as the code. The parts most likely to drift:

| If you change… | Update… |
|----------------|---------|
| An `/api/*` route | [05 – API reference](./05-api-reference.md) |
| A table or column (and regenerate `src/types/database.ts`) | [06 – Database](./06-database.md) |
| A token in `src/app/globals.css` | [08 – Design system](./08-design-system.md) |
| A `localStorage` key | [11 – Reader & client state](./11-reader-and-client-state.md) |
| An environment variable | [02 – Getting started](./02-getting-started.md) |
| A bug listed as known gets fixed | [14 – Known issues](./14-known-issues-and-roadmap.md) |
