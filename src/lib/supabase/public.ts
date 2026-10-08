import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase client for PUBLIC, cacheable reads (server only).
 *
 * Unlike `@/lib/supabase/server`, this never touches `cookies()`, so pages
 * that use it can be statically cached (ISR) and shared across visitors.
 *
 * It always runs as the `anon` role, never the visitor's session. That is a
 * safety property, not just a perf one: even if an admin is logged in when a
 * page regenerates, RLS hides admin-only rows, so a draft can never be baked
 * into a cached page that everyone gets served.
 *
 * Do NOT use it for admin reads or anything per-user; use the cookie client.
 *
 * @returns a fresh client per call (cheap: no session, no network until a query)
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
