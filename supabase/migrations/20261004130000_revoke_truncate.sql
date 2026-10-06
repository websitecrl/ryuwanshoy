-- Revoke TRUNCATE from anon and authenticated on every public table, now and
-- for tables created later.
--
-- RLS does not apply to TRUNCATE. With the grant in place, anyone holding the
-- public anon key could empty a table (series, chapters, pages, comments...)
-- in one request, policies or not. Nothing in the app truncates; admin writes
-- go through the service role, which keeps its privileges.
--
-- Checked against the live DB on 2026-10-04:
--   - All 9 public tables granted TRUNCATE to both anon and authenticated.
--   - Default privileges for tables created by postgres (dashboard, SQL
--     editor, migrations) granted it again (anon=Dxtm, authenticated=Dxtm).
--   - Every public table is owned by postgres.
--
-- Not covered: supabase_admin's own default privileges still grant ALL to
-- anon/authenticated. postgres cannot change another role's defaults, and
-- those only apply to tables supabase_admin creates (Supabase internals),
-- never to tables made through the dashboard or migrations. If a new public
-- table ever shows TRUNCATE for anon, re-run this file.
--
-- HOW TO APPLY: do NOT use `supabase db push`. It would also run
-- 20261003130000_rewrite_r2_public_urls.sql, which must wait for the custom
-- domain. Run this file on its own:
--   npx supabase db query --linked -f supabase/migrations/20261004130000_revoke_truncate.sql
--
-- Idempotent: revoking a privilege that isn't held is a no-op.
-- No column changes, so src/types/database.ts does not need regenerating.

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
