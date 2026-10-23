// { [seriesId]: true } in this browser. never rename the key
const STORAGE_KEY = 'ryu.bookmarks.series'

/** {} on the server or when unreadable */
export function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** save -> same-page storage event -> NavLink, Grid, SeriesHeader update */
export function saveBookmarkMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new Event('storage'))
  } catch {}
}

/** remove -> delete the entry (readers check === true) */
export function setSeriesBookmarked(seriesId: string, bookmarked: boolean) {
  const map = getBookmarkMap()
  if (bookmarked) map[seriesId] = true
  else delete map[seriesId]
  saveBookmarkMap(map)
}
