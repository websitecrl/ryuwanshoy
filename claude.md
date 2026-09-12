# Do Not Edit

Files/paths Claude Code must never modify in this project without explicit approval.

## Secrets & env
- `.env.local`, `.env*.local`
- Any file containing `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, R2/API keys

## Generated / auto-managed
- `src/types/database.ts` — Supabase-generated types, regenerate via CLI, never hand-edit
- `package-lock.json` / `pnpm-lock.yaml` — only via install commands
- `node_modules/`, `.next/`, `.wrangler/`

## Applied migrations
- `supabase/migrations/*.sql` — already-run migrations are immutable; new changes = new migration file

## Auth-critical (edit only with explicit review)
- `middleware.ts`
- Supabase RLS policy files

## Version control
- `.git/`

---
Add new entries here as the project grows.