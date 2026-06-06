'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { ReadingProgress } from '@/types/reader'

type Props = {
  seriesId: string
  seriesSlug: string
}

export default function ContinueReadingBar({ seriesId, seriesSlug }: Props) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`reading-progress-${seriesId}`)
      if (!raw) return

      const parsed = JSON.parse(raw) as ReadingProgress

      // Validate minimum shape — reject stale or corrupt entries
      if (
        typeof parsed.chapterNumber !== 'number' ||
        typeof parsed.chapterId !== 'string'
      ) {
        localStorage.removeItem(`reading-progress-${seriesId}`)
        return
      }

      setProgress(parsed)
    } catch {
      localStorage.removeItem(`reading-progress-${seriesId}`)
    }
  }, [seriesId])

  if (!progress) return null

  const chapterLabel = progress.title
    ? `CH. ${String(progress.chapterNumber).padStart(2, '0')} — ${progress.title.toUpperCase()}`
    : `CHAPTER ${progress.chapterNumber}`

  const hasPageProgress =
    typeof progress.currentPage === 'number' &&
    typeof progress.totalPages === 'number' &&
    progress.totalPages > 0

  const progressPercent = hasPageProgress
    ? Math.min(100, Math.round((progress.currentPage! / progress.totalPages!) * 100))
    : 0

  const href = `/comics/${seriesSlug}/${progress.chapterNumber}`

  return (
    <div
      className="mb-6 rounded-2xl border border-[var(--ryu-border)]
                 bg-[var(--ryu-surface-1)] shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-4 px-4 py-4">

        {/* Thumbnail */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden
                     bg-[var(--ryu-surface-2)] border border-[var(--ryu-border-soft)]"
        >
          {progress.thumbnailUrl ? (
            <Image
              src={progress.thumbnailUrl}
              alt="Chapter thumbnail"
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[var(--ryu-text-3)] text-lg">📖</span>
            </div>
          )}
        </div>

        {/* Info + progress bar */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--ryu-text-3)] leading-none mb-0.5">
            Last read
          </p>
          <p className="text-sm font-bold text-[var(--ryu-text)] truncate leading-snug">
            {chapterLabel}
          </p>

          {hasPageProgress && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full bg-[var(--ryu-border-soft)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--ryu-primary)] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-[var(--ryu-text-3)] flex-shrink-0">
                page {progress.currentPage} / {progress.totalPages}
              </span>
            </div>
          )}
        </div>

        {/* CONTINUE button */}
        <Link
          href={href}
          className="flex-shrink-0 px-4 py-2 rounded-full
                     bg-[var(--ryu-accent)] text-[var(--ryu-text)]
                     text-xs font-bold tracking-wide whitespace-nowrap
                     hover:bg-[var(--ryu-accent-deep)] transition-colors"
        >
          CONTINUE →
        </Link>

      </div>
    </div>
  )
}