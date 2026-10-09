// Series bookmarks live only in this browser: { [seriesId]: true }.
// Never rename this key: readers would lose their bookmarks.
const STORAGE_KEY = 'ryu.bookmarks.series'

/** @returns the saved bookmarks; {} on the server or when storage is unreadable */
export function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Saves the bookmarks and fires a same page 'storage' event, so
 * BookmarksNavLink, BookmarksGrid and SeriesHeader update right away (the
 * browser only fires it for OTHER tabs on its own).
 */
export function saveBookmarkMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new Event('storage'))
  } catch {}
}

/** Adds or removes one series. Removing deletes the entry (readers check `=== true`). */
export function setSeriesBookmarked(seriesId: string, bookmarked: boolean) {
  const map = getBookmarkMap()
  if (bookmarked) map[seriesId] = true
  else delete map[seriesId]
  saveBookmarkMap(map)
}
