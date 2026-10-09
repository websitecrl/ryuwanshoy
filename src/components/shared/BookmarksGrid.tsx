'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import SeriesCard from '@/components/reader/SeriesCard'
import type { Database } from '@/types/database'
import { getBookmarkMap, saveBookmarkMap } from '@/lib/bookmarks'
import { useMaxAge } from '@/hooks/useSavedAge'
import { fitsAge } from '@/lib/age'

type Series = Database['public']['Tables']['series']['Row']

const FEW_THRESHOLD = 3

type Props = {
  /** Every published series. */
  series: Series[]
  chapterCounts: Record<string, number>
  /** false when the series query failed, so missing ids can't be trusted. */
  seriesLoaded: boolean
}

export default function BookmarksGrid({ series, chapterCounts, seriesLoaded }: Props) {
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const maxAge = useMaxAge()

  useEffect(() => {
    setMounted(true)
    const map = getBookmarkMap()

    // Drop bookmarks for series that were deleted or unpublished, but only
    // when the list really loaded — a failed query must never wipe them.
    if (seriesLoaded) {
      const live = new Set(series.map(s => s.id))
      const stale = Object.keys(map).filter(id => !live.has(id))
      if (stale.length) {
        for (const id of stale) delete map[id]
        saveBookmarkMap(map) // also keeps BookmarksNavLink in sync
      }
    }
    setBookmarkMap(map)

    function refresh() {
      setBookmarkMap(getBookmarkMap())
    }
    // Sync when a SeriesCard elsewhere toggles a bookmark on the same page
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [series, seriesLoaded])

  // Avoid a flash of the empty state before localStorage is read
  if (!mounted) return null

  // Series above the reader's saved age are hidden, not unbookmarked: they
  // come back if the reader picks an older age. The stale cleanup above must
  // keep using the full `series` list, or it would delete them.
  const bookmarked = series.filter(s => bookmarkMap[s.id] === true && fitsAge(s.min_age, maxAge))

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-8">
      <div className="flex items-center gap-3" style={{ marginBottom: 24 }}>
        <div style={{ width: 5, height: 26, background: 'var(--ryu-primary)', borderRadius: 2, flexShrink: 0 }} />
        <span
          className="font-comic"
          style={{ fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ryu-text)' }}
        >
          Your Bookmarks
        </span>
      </div>

      {bookmarked.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center gap-3 rounded-xl border"
          style={{ borderColor: 'var(--ryu-border)', color: 'var(--ryu-text-3)', padding: '96px 24px' }}
        >
          <Bookmark size={36} strokeWidth={1.5} />
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--ryu-text-2)', fontFamily: "var(--font-fredoka), sans-serif" }}
          >
            No bookmarks yet
          </p>
          <p className="text-xs max-w-xs" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>
            Tap the bookmark icon on any series to save it here for later.
          </p>
          <Link
            href="/comics"
            className="font-comic flex items-center gap-1 px-4 rounded-lg
              text-sm uppercase tracking-wide border-2
              shadow-[4px_4px_0px_var(--ryu-ink)]
              hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-ink)]
              transition-all duration-100"
            style={{
              height: 36,
              marginTop: 8,
              borderColor: 'var(--ryu-ink)',
              background: 'var(--ryu-accent)',
              color: 'var(--ryu-on-accent)',
            }}
          >
            Browse Comics
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {bookmarked.map(s => (
              <SeriesCard key={s.id} series={s} chapterCount={chapterCounts[s.id] ?? 0} />
            ))}
          </div>

          {bookmarked.length < FEW_THRESHOLD && (
            <div className="flex items-center justify-center" style={{ marginTop: 40 }}>
              <Link
                href="/comics"
                className="text-sm font-semibold transition-colors"
                style={{ color: 'var(--ryu-primary)', fontFamily: "var(--font-fredoka), sans-serif" }}
              >
                Browse more comics to bookmark →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
