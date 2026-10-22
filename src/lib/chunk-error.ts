// After a deploy, an old tab asks for replaced JS/CSS chunks; only a full reload fixes it, reset() doesn't.

const CHUNK_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message ?? '')
}

const RELOAD_KEY = 'ryu.chunk_reload_at'
// At most one reload per window, so a truly missing chunk shows the error instead of looping.
const RELOAD_WINDOW_MS = 30_000

/** Reloads once. Returns false when it already reloaded recently or storage is blocked. */
export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
