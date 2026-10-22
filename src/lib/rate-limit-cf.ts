import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/** Names of the Workers Rate Limiting bindings declared in wrangler.jsonc. */
export type RateLimitBinding = Extract<keyof CloudflareEnv, `${string}_LIMITER`>

/** Rate limits by client IP with a Workers binding. Returns a 429 to send, or null. Call before any write. */
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
    // Fail open: a binding outage shouldn't take down comments and likes.
    console.error(`[rate-limit] ${binding} check failed:`, err)
    return null
  }

  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
