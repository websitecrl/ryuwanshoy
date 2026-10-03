import { toast } from 'sonner'

/**
 * Client-side handling for 429s from the Workers rate limiters
 * (see src/lib/rate-limit-cf.ts). The server only says "Too many requests",
 * so the reader-facing wording lives here, in one place.
 */
export function toastRateLimited(): void {
  // Fixed id so rapid retries (e.g. spamming the like button) replace the
  // toast instead of stacking a new one each time.
  toast.error("You're doing that too often. Please wait a minute and try again.", {
    id: 'rate-limited',
  })
}
