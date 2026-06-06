// In-memory rate limiter 
// Works on a single always-on Node server (e.g.Render )
// On CloudFlare Pages (serverless), use CF rate-limiting rules instead

type Entry = { count: number; resetAt: number }
const store = new Map<string , Entry>()

let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 5 * 60_000) return
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
  lastSweep = now 
}

export function checkRateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  sweep(now)
  const entry  = store.get(key)
  
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs})
    return true
  }
  if (entry.count >= limit) return false 
  entry.count += 1 
  return true 
}

