# 2. Getting started

## Prerequisites

- **Node.js** 20 LTS or newer (Next.js 16 requires ≥ 20.9) and **npm** (the repo has a `package-lock.json`).
- A **Supabase** project (URL, anon key, service-role key) with the tables described in [Database](./06-database.md).
- A **Cloudflare** account with two **R2 buckets** (public + private/EA) and an R2 API token — needed for any upload to work.
- Optional: reCAPTCHA v2 keys (Early Access), a Mailchimp audience (Early Access sync), a Sentry project.

## Install and run

```bash
npm install
# create .env.local (and .dev.vars — see below) with the variables in the next section
npm run dev
```

The dev server runs on <http://localhost:3000> (Turbopack). `next.config.ts` calls `initOpenNextCloudflareForDev()`, so Cloudflare bindings from `wrangler.jsonc` are emulated during `next dev`.

> There is **no `.env.example`** committed, although the root README mentions one. Use the table below.

### Create the admin user

Admin access is not a role in the database — it is a single Supabase Auth user identified by UUID:

1. In the Supabase dashboard → **Authentication → Users**, create a user with an email and password.
2. Copy that user's **UUID** into `ADMIN_USER_ID`.
3. Sign in at <http://localhost:3000/admin>.

Any other authenticated user can log in to `/admin` pages via the session check in `middleware.ts`, but every mutating API route checks `user.id === ADMIN_USER_ID` and will answer `401` — see [Auth & security](./09-auth-and-security.md#two-layers-of-admin-protection).

## Environment files

| File | Used by | Committed? |
|------|---------|-----------|
| `.env.local` | `next dev` / `next build` (and `NEXT_PUBLIC_*` values inlined at build time) | No (gitignored) |
| `.dev.vars` | Wrangler / Workers local runtime (`wrangler dev`, OpenNext preview) | No (gitignored) |

The repo's local copies of both files define the same set of keys. Keep them in sync.

> **Never** commit either file, and never paste values into docs, issues or commits. `SUPABASE_SERVICE_ROLE_KEY` and every `R2_*` key are server-only.

## Environment variables

| Variable | Exposed to browser? | Required? | Used by | Purpose |
|----------|:------------------:|:---------:|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | **yes** | all Supabase clients, middleware | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | **yes** | browser + server session clients, middleware | Anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | **yes** | `src/lib/supabase/admin.ts` | Service-role key (bypasses RLS) |
| `ADMIN_USER_ID` | no | **yes** | `src/lib/require-admin.ts`, `api/comments/[id]` | UUID of the one admin user |
| `R2_BUCKET_NAME` | no | **yes** | `src/lib/r2.ts` | Public bucket name |
| `R2_EA_BUCKET_NAME` | no | **yes**¹ | `src/lib/r2.ts` | Private Early Access bucket name |
| `R2_ENDPOINT` | no | **yes** | `src/lib/r2.ts` | R2 S3-API **origin only** (no bucket/path) |
| `R2_PUBLIC_URL` | no | **yes** | `src/lib/r2.ts` | Public bucket origin (custom domain or `*.r2.dev`), **no path** |
| `R2_ACCESS_KEY_ID` | no | **yes** | `src/lib/r2.ts` | R2 API token key id |
| `R2_SECRET_ACCESS_KEY` | no | **yes** | `src/lib/r2.ts` | R2 API token secret |
| `R2_ACCOUNT_ID` | no | no | *(present in the env files, not read by code)* | — |
| `NEXT_PUBLIC_SITE_URL` | yes | recommended | metadata, `sitemap.ts`, `robots.ts` | Canonical origin; falls back to `https://ryuwanshoy.com` |
| `NEXT_PUBLIC_EARLY_ACCESS_ENABLED` | yes | no | EA page, EA API, admin UI | `"true"` enables Early Access. Anything else = off. **Inlined at build time** — changing it needs a rebuild. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | yes | only for EA | `app/early-access/page.tsx` | reCAPTCHA v2 site key |
| `RECAPTCHA_SECRET_KEY` | no | only for EA | `api/early-access` | reCAPTCHA verification |
| `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`, `MAILCHIMP_SERVER_PREFIX` | no | optional | `api/early-access` | If any is missing, the Mailchimp sync is skipped with a console warning |

¹ `getR2()` validates **all** R2 variables on every call, including `R2_EA_BUCKET_NAME`. If the EA bucket variable is blank, *public* uploads fail too with `R2 misconfigured — missing env var(s): …`.

### R2 variable rules (enforced in code)

- `R2_ENDPOINT` and `R2_PUBLIC_URL` must be **bare origins**, e.g. `https://<something>` with no trailing bucket name. A path segment makes `getR2()` throw immediately. This exists because a bucket name accidentally left on the endpoint once caused files to land under an extra folder while the returned URL pointed elsewhere.
- Object URLs are built as `${R2_PUBLIC_URL}/${key}?v=${Date.now()}`; the bucket name is added only on the S3 API side (`${R2_ENDPOINT}/${bucket}/${key}`).

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next dev server (Turbopack) on :3000 |
| `npm run build` | `next build --webpack` |
| `npm run start` | Next production server (not used for Cloudflare) |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run format` / `format:check` | Prettier write / check |
| `npx tsc --noEmit` | Type-check the whole project (no script alias exists) |
| `npx opennextjs-cloudflare build` | Build the app and repackage it into `.open-next/` for Workers |
| `npx opennextjs-cloudflare deploy` | Upload the built Worker + assets to Cloudflare |
| `npx supabase gen types typescript --project-id <id> > src/types/database.ts` | Regenerate DB types after **any** schema change |

The root README also lists `npm run preview`; **no such script exists** in `package.json`.

## Editor & formatting

- `.prettierrc` and `.prettierignore` are present; `.vscode/settings.json` is tracked.
- Windows checkouts print `LF will be replaced by CRLF` warnings from git; they are harmless.
- `tsconfig.json` uses `strict` **and** `noUncheckedIndexedAccess` — array/record indexing returns `T | undefined`, so code uses `?.`, `!` or `?? default` accordingly.

## First-run checklist

1. `.env.local` and `.dev.vars` populated (all "required" rows above).
2. Supabase tables exist and Row Level Security is configured (see [Database](./06-database.md#row-level-security)).
3. `check_rate_limit` function and `rate_limits` table exist (comments/likes/EA depend on them; the limiter fails open if the RPC errors).
4. Admin user created and `ADMIN_USER_ID` set.
5. R2 buckets exist and the public bucket is reachable at `R2_PUBLIC_URL`.
6. `http://localhost:3000` loads → pick an age on the gate → `/admin` login works → upload a series cover to verify R2.

If an upload fails, jump to [Troubleshooting](./13-deployment-and-operations.md#troubleshooting).
