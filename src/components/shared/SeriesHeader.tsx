'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Bookmark, Share2, Bell, BookOpen, RotateCcw } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import type { Tables } from '@/types/database'
import type { ReadingProgress } from '@/types/reader'

type Props = {
  series: Tables<'series'>
  chapterCount: number
  totalPages: number
  lastPublishedAt: string | null
  firstChapterNumber: number
}

const STORAGE_KEY = 'ryu.bookmarks.series'

function getBookmarkMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Same key/shape as ContinueReadingBar and ChapterList — reading-progress-{seriesId}
function getReadingProgress(seriesId: string): ReadingProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`reading-progress-${seriesId}`)
    if (!raw) return null

    const parsed = JSON.parse(raw) as ReadingProgress
    if (typeof parsed.chapterNumber !== 'number' || typeof parsed.chapterId !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export default function SeriesHeader({
  series,
  chapterCount,
  totalPages,
  lastPublishedAt,
  firstChapterNumber,
}: Props) {
  const [bookmarked, setBookmarked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState<ReadingProgress | null>(null)

  // Hydrate bookmark state from localStorage (same key as BookmarksNavLink/BookmarksGrid)
  useEffect(() => {
    const map = getBookmarkMap()
    setBookmarked(map[series.id] === true)
  }, [series.id])

  // Hydrate reading progress from localStorage (same key as ContinueReadingBar/ChapterList)
  useEffect(() => {
    setProgress(getReadingProgress(series.id))
  }, [series.id])

  function handleRestart() {
    try {
      localStorage.removeItem(`reading-progress-${series.id}`)
    } catch {}
    setProgress(null)
  }

  function toggleBookmark() {
    const map = getBookmarkMap()
    const next = !bookmarked
    if (next) {
      map[series.id] = true
    } else {
      delete map[series.id]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    setBookmarked(next)

    // Notify BookmarksNavLink/BookmarksGrid on the same page (they listen to 'storage' event)
    window.dispatchEvent(new Event('storage'))
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: series.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const genres = series.genre
    ? series.genre.split(',').map(g => g.trim()).filter(Boolean)
    : []

  const updatedLabel = timeAgo(lastPublishedAt)
  const startHref = `/comics/${series.slug}/${firstChapterNumber}`

  const hasProgress = progress !== null
  const continueHref = progress
    ? progress.currentPage && progress.currentPage > 1
      ? `/comics/${series.slug}/${progress.chapterNumber}?page=${progress.currentPage}`
      : `/comics/${series.slug}/${progress.chapterNumber}`
    : startHref
  const ctaHref = hasProgress ? continueHref : startHref
  const ctaLabel = hasProgress ? `CONTINUE — CH. ${progress!.chapterNumber}` : 'START READING'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-12 pb-8 sm:pb-12">
      <div className="flex gap-6 sm:gap-8">

        {/* Cover image */}
        <div className="flex-shrink-0 w-28 sm:w-40 md:w-48">
          <div
            className="relative w-full aspect-[460/640] rounded-xl overflow-hidden
                       border border-[var(--ryu-border)] shadow-lg
                       bg-[var(--ryu-surface-2)]"
          >
            {series.cover_image ? (
              <Image
                src={series.cover_image}
                alt={`${series.title} cover`}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[var(--ryu-text-3)] text-xs text-center px-2">
                  No Cover
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Series info */}
        <div className="flex-1 min-w-0">

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {updatedLabel && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide
                           bg-[var(--ryu-primary)] text-[var(--ryu-on-primary)]"
              >
                {updatedLabel}
              </span>
            )}

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                         tracking-wide uppercase ${
                           series.status === 'completed'
                             ? 'border-blue-400 text-blue-600 dark:text-blue-400'
                             : series.status === 'hiatus'
                             ? 'border-yellow-400 text-yellow-600 dark:text-yellow-400'
                             : 'border-emerald-400 text-emerald-600 dark:text-emerald-400'
                         }`}
            >
              {series.status === 'completed'
                ? 'Completed'
                : series.status === 'hiatus'
                ? 'Hiatus'
                : 'Ongoing'}
            </span>

            {genres.map(genre => (
              <span
                key={genre}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold border
                           border-[var(--ryu-border)] text-[var(--ryu-text-2)]
                           tracking-wide uppercase"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1
            className="font-comic text-3xl sm:text-4xl md:text-5xl
                       text-[var(--ryu-text)] leading-none mb-3"
          >
            {series.title}
          </h1>

          {/* Stats row */}
          <div className="flex items-center gap-8 py-4 border-y border-[var(--ryu-border)] mb-5">
            <div className="flex items-center gap-1.5">
              <span className="font-comic text-4xl text-[var(--ryu-text)]">{chapterCount}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--ryu-text-3)]">chapters</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* START READING / CONTINUE */}
          <Link
            href={ctaHref}
            className="font-comic flex items-center gap-1 px-4
              bg-[var(--ryu-accent)] text-[var(--ryu-on-accent)]
              border-2 border-[var(--ryu-text)] rounded-lg
              text-sm uppercase tracking-wide
              shadow-[4px_4px_0px_var(--ryu-text)]
              hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-text)]
              transition-all duration-100"
            style={{ height: '36px' }}
          >
            <BookOpen size={14} />
            {ctaLabel}
          </Link>

          {/* RESTART — only shown when there's progress to restart from */}
          {hasProgress && (
            <Link
              href={startHref}
              onClick={handleRestart}
              aria-label="Restart from Chapter 1"
              title="Restart from Chapter 1"
              className="flex items-center justify-center flex-shrink-0
                bg-[var(--ryu-surface-3)] text-[var(--ryu-text)]
                border-2 border-[var(--ryu-text)] rounded-lg
                shadow-[4px_4px_0px_var(--ryu-text)]
                hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-text)]
                transition-all duration-100"
              style={{ width: '44px', height: '44px' }}
            >
              <RotateCcw size={16} />
            </Link>
          )}

          {/* BOOKMARK */}
          <button
            onClick={toggleBookmark}
            className={`font-comic flex items-center gap-1 px-4
              border-2 border-[var(--ryu-text)] rounded-lg
              text-sm uppercase tracking-wide
              shadow-[4px_4px_0px_var(--ryu-text)]
              hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-text)]
              transition-all duration-100 ${
                bookmarked
                  ? 'bg-[var(--ryu-accent)] text-[var(--ryu-on-accent)]'
                  : 'bg-[var(--ryu-surface-3)] text-[var(--ryu-text)]'
              }`}
            style={{ height: '36px' }}
          >
            <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
            BOOKMARK
          </button>

          {/* SHARE */}
          <button
            onClick={handleShare}
            className="font-comic flex items-center gap-1 px-4
              bg-[var(--ryu-surface-3)] text-[var(--ryu-text-2)]
              border-2 border-[var(--ryu-border)] rounded-lg
              text-sm uppercase tracking-wide
              shadow-[4px_4px_0px_var(--ryu-border)]
              hover:-translate-y-0.5 hover:shadow-[4px_6px_0px_var(--ryu-border)]
              transition-all duration-100"
            style={{ height: '36px' }}
          >
            <Share2 size={14} />
            {copied ? 'Copied!' : 'Share'}
          </button>

            {process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true' && (
              <Link
                href="/early-access"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border
                           border-[var(--ryu-text)] text-[var(--ryu-text)]
                           text-sm font-semibold
                           hover:bg-[var(--ryu-surface-3)] transition-colors"
              >
                <Bell size={14} />
                SUBSCRIBE
              </Link>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}