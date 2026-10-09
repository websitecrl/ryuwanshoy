'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Bookmark, BookImage } from 'lucide-react'
import type { Database } from '@/types/database'
import { getBookmarkMap, setSeriesBookmarked } from '@/lib/bookmarks'

type Series = Database['public']['Tables']['series']['Row']

interface SeriesCardProps {
  series: Series
  chapterCount: number
}

export default function SeriesCard({ series, chapterCount }: SeriesCardProps) {
  const [bookmarked, setBookmarked] = useState(false)

  // Read bookmark state from localStorage on mount
  useEffect(() => {
    setBookmarked(getBookmarkMap()[series.id] === true)
  }, [series.id])

  function toggleBookmark() {
    const next = !bookmarked
    setSeriesBookmarked(series.id, next)
    setBookmarked(next)
  }

  const chapterLabel = chapterCount === 1 ? '1 chapter' : `${chapterCount} chapters`
  const statusLabel = series.status === 'ongoing' ? 'Ongoing' : series.status === 'hiatus' ? 'Hiatus' : 'Completed'
  const metaLine = [series.genre, statusLabel, chapterLabel].filter(Boolean).join(' · ')

  // The bookmark button sits NEXT TO the link, not inside it (a button inside
  // a link is invalid HTML and confuses keyboard and screen reader users).
  // It's positioned over the cover's top right corner.
  return (
    <div
      className="group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        borderColor: 'var(--ryu-border)',
        backgroundColor: 'var(--ryu-surface-1)',
      }}
    >
    <Link href={`/comics/${series.slug}`} className="flex flex-1 flex-col gap-0">
      {/* Cover */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '460/640', backgroundColor: 'var(--ryu-surface-3)' }}
      >
        {series.cover_image ? (
          <Image
            src={series.cover_image}
            alt={series.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookImage size={32} strokeWidth={1.5} style={{ color: 'var(--ryu-text-3)' }} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3">
        {/* Title */}
        <p
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{
            color: 'var(--ryu-text)',
            fontFamily: "var(--font-fredoka), sans-serif",
          }}
        >
          {series.title}
        </p>

        {/* Age rating badge — kept as a pill since it's a warning signal, not descriptive metadata */}
        {series.min_age != null && series.min_age > 0 && (
          <div className="flex items-center">
            <span
              className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{
                fontFamily: "var(--font-fredoka), sans-serif",
                fontWeight: 600,
                letterSpacing: '0.02em',
                background: series.min_age === 18
                  ? '#A32D2D'
                  : series.min_age === 16
                  ? '#854F0B'
                  : '#3B6D11',
                color: '#fff',
              }}
            >
              {series.min_age}+
            </span>
          </div>
        )}

        {/* Genre · status · chapter count — one consistent, plain-text treatment */}
        <p
          className="text-xs font-medium truncate"
          style={{
            color: 'var(--ryu-text-2)',
            fontFamily: "var(--font-fredoka), sans-serif",
          }}
        >
          {metaLine}
        </p>
      </div>
    </Link>

      {/* Bookmark button */}
      <button
        type="button"
        onClick={toggleBookmark}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark series'}
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
        style={{
          background: bookmarked
            ? 'var(--ryu-primary)'
            : 'rgba(0,0,0,0.55)',
          color: '#fff',
          border: 'none',
        }}
      >
        <Bookmark
          size={15}
          fill={bookmarked ? '#fff' : 'none'}
          strokeWidth={2}
        />
      </button>
    </div>
  )
}