'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Bookmark, BookImage } from 'lucide-react'
import type { Database } from '@/types/database'

type Series = Database['public']['Tables']['series']['Row']

interface SeriesCardProps {
  series: Series
  chapterCount: number
}

export default function SeriesCard({ series, chapterCount }: SeriesCardProps) {
  const [bookmarked, setBookmarked] = useState(false)

  // Read bookmark state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ryu.bookmarks.series')
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        setBookmarked(!!parsed[series.id])
      }
    } catch {}
  }, [series.id])

  function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      const saved = localStorage.getItem('ryu.bookmarks.series')
      const parsed: Record<string, boolean> = saved ? JSON.parse(saved) : {}
      const next = !bookmarked
      parsed[series.id] = next
      localStorage.setItem('ryu.bookmarks.series', JSON.stringify(parsed))
      setBookmarked(next)
      window.dispatchEvent(new StorageEvent('storage'))
    } catch {}
  }

  const chapterLabel = chapterCount === 1 ? '1 chapter' : `${chapterCount} chapters`
  const statusLabel = series.status === 'ongoing' ? 'Ongoing' : series.status === 'hiatus' ? 'Hiatus' : 'Completed'
  const metaLine = [series.genre, statusLabel, chapterLabel].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/comics/${series.slug}`}
      className="group flex flex-col gap-0 rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        borderColor: 'var(--ryu-border)',
        backgroundColor: 'var(--ryu-surface-1)',
      }}
    >
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

        {/* Bookmark button */}
        <button
          onClick={toggleBookmark}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark series'}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
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
  )
}