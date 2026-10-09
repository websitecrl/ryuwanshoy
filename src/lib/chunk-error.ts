/**
 * "Missing code file" errors after a deploy.
 *
 * A tab opened before a deploy still holds the old build. When it loads a
 * page it hasn't loaded yet, it asks for an old JS/CSS chunk that the deploy
 * replaced, and the request fails. Calling reset() reruns the same old build
 * and fails again; only a full reload fetches the new HTML (and with it the
 * new chunk names). So the error screens reload instead.
 */

// Webpack ("ChunkLoadError: Loading chunk 2265 failed.", "Loading CSS chunk
// ... failed") plus the browsers' own wording for a failed dynamic import.
const CHUNK_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message ?? '')
}

const RELOAD_KEY = 'ryu.chunk_reload_at'
// Reload at most once per this window, so a chunk that is truly missing
// (not just an old tab) shows the error screen instead of looping.
const RELOAD_WINDOW_MS = 30_000

/**
 * Reloads the page once. Returns false (and does nothing) when it already
 * reloaded in the last 30 seconds, or when storage is blocked.
 */
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
