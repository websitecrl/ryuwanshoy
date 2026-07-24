import 'server-only'
import { NextRequest } from 'next/server'
import { getsupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Resolve a client IP to rate-limit on.
 *
 * Priority: CF-Connecting-IP (set by Cloudflare/Render's edge, trustworthy
 * as long as the app isn't directly reachable bypassing that edge) →
 * first entry of x-forwarded-for (less trustworthy, can be client-influenced,
 * used only as fallback) → a random per-request id.
 *
 * The random fallback matters: pooling all header-less requests into a
 * single 'unknown' bucket would let one attacker with no IP headers
 * exhaust that bucket and lock out other legitimate header-less clients.
 * A random id per request means each such request is limited individually
 * instead — it doesn't add protection against a determined attacker who
 * strips headers, but it stops them from collaterally rate-limiting
 * everyone else.
 */
export function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('CF-Connecting-IP')
  if (cfIp) return cfIp.trim()

  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()

  return `unknown:${crypto.randomUUID()}`
}

/**
 * Durable, atomic rate limiter backed by the `rate_limits` table +
 * `check_rate_limit` Postgres function. Replaces the old in-memory Map,
 * which reset on every cold start/restart and didn't share state across
 * multiple instances.
 *
 * Same signature as before, but now async — callers must `await` it.
 */
export async function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000
): Promise<boolean> {
  const supabaseAdmin = getsupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: Math.floor(windowMs / 1000),
  })

  if (error) {
    // Fail open: a rate-limit outage shouldn't take down the comment/like
    // forms for everyone. Still log it — if this fires repeatedly, the
    // DB call itself is broken and needs attention.
    console.error('[rate-limit] check_rate_limit failed:', error.message)
    return true
  }

  return data === true
}