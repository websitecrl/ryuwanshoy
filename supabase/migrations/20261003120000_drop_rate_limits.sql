-- Drop the Postgres-backed rate limiter.
--
-- Rate limiting moved to Cloudflare Workers Rate Limiting bindings
-- (wrangler.jsonc ratelimits + src/lib/rate-limit-cf.ts). Nothing in the app
-- calls check_rate_limit or reads rate_limits anymore.
--
-- Run ONLY after the Worker that no longer calls check_rate_limit is deployed.
-- An older deployment still calling the RPC would error, and the old helper
-- failed open, so requests would go through unlimited until the new deploy.
--
-- After applying, regenerate src/types/database.ts with the Supabase CLI.

-- Function first: it writes to rate_limits.
DROP FUNCTION IF EXISTS public.check_rate_limit(text, integer, integer);

-- Drops its primary key, RLS setting and grants along with it.
DROP TABLE IF EXISTS public.rate_limits;
