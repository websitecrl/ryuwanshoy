import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/** Names of the Workers Rate Limiting bindings declared in wrangler.jsonc. */
export type RateLimitBinding = Extract<keyof CloudflareEnv, `${string}_LIMITER`>

/**
 * Rate limit a request by client IP using a Workers Rate Limiting binding.
 *
 * Each binding has its own namespace, so the IP alone is the key.
 * Cloudflare always sets cf-connecting-ip on requests through its edge;
 * "unknown" only covers requests that somehow arrive without it.
 *
 * Returns a 429 response to send back, or null when the request may proceed.
 * Call it before any DB write, reCAPTCHA call, or other external request.
 */
export async function rateLimit(
  req: NextRequest,
  binding: RateLimitBinding
): Promise<NextResponse | null> {
  const key = req.headers.get('cf-connecting-ip')?.trim() || 'unknown'

  try {
    const { env } = getCloudflareContext()
    const { success } = await env[binding].limit({ key })
    if (success) return null
  } catch (err) {
    // Fail open: a binding outage shouldn't take down comments/likes/signups
    // for everyone. Logged so a misconfigured binding doesn't go unnoticed.
    console.error(`[rate-limit] ${binding} check failed:`, err)
    return null
  }

  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
