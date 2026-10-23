// RateLimit type (env types are generated without runtime types, which break DOM globals)

interface RateLimitOptions {
  key: string
}

interface RateLimitOutcome {
  success: boolean
}

interface RateLimit {
  limit(options: RateLimitOptions): Promise<RateLimitOutcome>
}
