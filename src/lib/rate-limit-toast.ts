import { toast } from 'sonner'

/** 429 -> reader-facing toast (wording lives here) */
export function toastRateLimited(): void {
  // fixed id -> retries replace the toast
  toast.error("You're doing that too often. Please wait a minute and try again.", {
    id: 'rate-limited',
  })
}
