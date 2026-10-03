// Workers Rate Limiting binding types, used by CloudflareEnv in cloudflare-env.d.ts.
//
// cloudflare-env.d.ts is generated with `--include-runtime=false` because the full
// Workers runtime types override DOM globals (e.g. Response.json() → unknown) and
// break client components. That leaves RateLimit undeclared, and skipLibCheck would
// silently turn it into `any`, so it's declared here to match workerd's definition.
// See https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

interface RateLimitOptions {
  key: string
}

interface RateLimitOutcome {
  success: boolean
}

interface RateLimit {
  limit(options: RateLimitOptions): Promise<RateLimitOutcome>
}
