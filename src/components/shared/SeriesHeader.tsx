'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Bookmark, Share2, Bell, BookOpen } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import type { Tables } from '@/types/database'

type Props = {
  series: Tables<'series'>
  chapterCount: number
  totalPages: number
  lastPublishedAt: string | null
  firstChapterNumber: number
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

  // Hydrate bookmark state from localStorage
  useEffect(() => {
    setBookmarked(
      localStorage.getItem(`bookmark-series-${series.id}`) === 'true'
    )
  }, [series.id])

  function toggleBookmark() {
    const next = !bookmarked
    setBookmarked(next)
    localStorage.setItem(`bookmark-series-${series.id}`, String(next))
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

  // Genre supports comma-separated values e.g. "Action, Drama, Historical"
  const genres = series.genre
    ? series.genre.split(',').map(g => g.trim()).filter(Boolean)
    : []

  const updatedLabel = timeAgo(lastPublishedAt)
  const startHref = `/comics/${series.slug}/${firstChapterNumber}`

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex gap-6 sm:gap-8">

        {/* ── Cover image ── */}
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

        {/* ── Series info ── */}
        <div className="flex-1 min-w-0">

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">

            {updatedLabel && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide
                           bg-[var(--ryu-primary)] text-white"
              >
                {updatedLabel}
              </span>
            )}

            {/* Status — TODO: replace hardcoded color classes with --ryu-* tokens */}
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

            {/* Genre tags — TODO: replace hardcoded color classes with --ryu-* tokens */}
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
          <div
            className="flex items-center gap-8 py-4
                       border-y border-[var(--ryu-border)] mb-5"
          >
            <div>
              <p className="text-xl font-bold text-[var(--ryu-text)]">
                {chapterCount}
              </p>
              <p className="text-xs text-[var(--ryu-text-3)] mt-0.5">chapters</p>
            </div>

            {totalPages > 0 && (
              <div>
                <p className="text-xl font-bold text-[var(--ryu-text)]">
                  {totalPages}
                </p>
                <p className="text-xs text-[var(--ryu-text-3)] mt-0.5">pages</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">

              {/* START READING — yellow accent fill */}
              <Link
                href={startHref}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full
                          bg-[var(--ryu-accent)] text-[var(--ryu-text)]
                          text-sm font-bold tracking-wide
                          hover:bg-[var(--ryu-accent-deep)] transition-colors"
              >
                <BookOpen size={14} />
                START READING
              </Link>

              {/* BOOKMARK — outlined */}
              <button
                onClick={toggleBookmark}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border-2
                          text-sm font-bold tracking-wide transition-colors ${
                            bookmarked
                              ? 'bg-[var(--ryu-primary-soft)] border-[var(--ryu-primary)] text-[var(--ryu-primary)]'
                              : 'border-[var(--ryu-text)] text-[var(--ryu-text)] hover:bg-[var(--ryu-surface-3)]'
                          }`}
              >
                <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
                BOOKMARK
              </button>

              {/* SHARE — outlined, slightly muted */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border
                          border-[var(--ryu-border)] text-[var(--ryu-text-2)]
                          text-sm font-semibold
                          hover:bg-[var(--ryu-surface-3)] transition-colors"
              >
                <Share2 size={14} />
                {copied ? 'Copied!' : 'Share'}
              </button>

            {/* SUBSCRIBE — only rendered when EA is enabled */}
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