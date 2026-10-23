import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/** *_LIMITER bindings in wrangler.jsonc */
export type RateLimitBinding = Extract<keyof CloudflareEnv, `${string}_LIMITER`>

/** client IP -> binding -> 429 response or null. call before writes */
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
    // fail open
    console.error(`[rate-limit] ${binding} check failed:`, err)
    return null
  }

  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
