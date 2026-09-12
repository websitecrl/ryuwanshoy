'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import SeriesCard from '@/components/admin/reader/SeriesCard'
import type { Database } from '@/types/database'

type Series = Database['public']['Tables']['series']['Row']

const STORAGE_KEY = 'ryu.bookmarks.series'
const FEW_THRESHOLD = 3

function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

type Props = {
  series: Series[]
  chapterCounts: Record<string, number>
}

export default function BookmarksGrid({ series, chapterCounts }: Props) {
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBookmarkMap(getBookmarkMap())

    function refresh() {
      setBookmarkMap(getBookmarkMap())
    }
    // Sync when a SeriesCard elsewhere toggles a bookmark on the same page
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  // Avoid a flash of the empty state before localStorage is read
  if (!mounted) return null

  const bookmarked = series.filter(s => bookmarkMap[s.id] === true)

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
              shadow-[4px_4px_0px_var(--ryu-text)]
              hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-text)]
              transition-all duration-100"
            style={{
              height: 36,
              marginTop: 8,
              borderColor: 'var(--ryu-text)',
              background: 'var(--ryu-accent)',
              color: 'var(--ryu-text)',
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
