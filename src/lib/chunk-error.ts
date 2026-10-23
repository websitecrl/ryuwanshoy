// deploy -> old tab asks for replaced chunks -> full reload (reset() fails again)

const CHUNK_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message ?? '')
}

const RELOAD_KEY = 'ryu.chunk_reload_at'
// one reload per window -> truly missing chunk shows the error
const RELOAD_WINDOW_MS = 30_000

/** reload once; false if reloaded recently or storage blocked */
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
