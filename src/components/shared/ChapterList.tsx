'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import type { ChapterWithPageCount, ReadingProgress } from '@/types/reader'
import ContinueReadingBar from './ContinueReadingBar'

type Props = {
  chapters: ChapterWithPageCount[]
  seriesId: string
  seriesSlug: string
  seriesDescription?: string | null
}

type Tab = 'chapters' | 'about'
type SortOrder = 'desc' | 'asc'

type ChapterReadState = {
  state: 'unread' | 'reading' | 'read'
  currentPage?: number
  totalPages?: number
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 px-1 mr-5 text-sm font-semibold border-b-2 -mb-px
                 transition-colors ${
                   active
                     ? 'border-[var(--ryu-primary)] text-[var(--ryu-primary)]'
                     : 'border-transparent text-[var(--ryu-text-3)] hover:text-[var(--ryu-text-2)]'
                 }`}
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1 font-normal">· {count}</span>
      )}
    </button>
  )
}

// ─── Chapter row ──────────────────────────────────────────────────────────────

function ChapterRow({
  chapter,
  seriesSlug,
  readState,
  isNewest,
  isLast,
}: {
  chapter: ChapterWithPageCount
  seriesSlug: string
  readState: ChapterReadState
  isNewest: boolean
  isLast: boolean
}) {
  const href = `/comics/${seriesSlug}/${chapter.chapter_number}`
  const chapterLabel = chapter.title ?? `Chapter ${chapter.chapter_number}`

  function SubLabel() {
    if (readState.state === 'reading' && readState.currentPage && readState.totalPages) {
      return (
        <span className="text-xs text-[var(--ryu-primary)]">
          Continue · page {readState.currentPage} / {readState.totalPages}
        </span>
      )
    }
    if (readState.state === 'read') {
      return <span className="text-xs text-[var(--ryu-text-3)]">Read</span>
    }
    if (isNewest) {
      return <span className="text-xs text-[var(--ryu-primary)]">New chapter</span>
    }
    return null
  }

  const btn = {
    unread:  { label: 'READ →',     cls: 'bg-[var(--ryu-text)] text-[var(--ryu-surface-1)]' },
    reading: { label: 'CONTINUE →', cls: 'bg-[var(--ryu-text)] text-[var(--ryu-surface-1)]' },
    read:    { label: 'RE-READ →',  cls: 'bg-[var(--ryu-surface-3)] text-[var(--ryu-text-2)] border border-[var(--ryu-border)]' },
  }[readState.state]

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4
                 hover:bg-[var(--ryu-surface-2)] transition-colors
                 ${!isLast ? 'border-b border-[var(--ryu-border-soft)]' : ''}`}
    >
      {/* Chapter number + new dot */}
      <div className="flex-shrink-0 w-6 relative flex items-center justify-center">
        <span className="text-sm text-[var(--ryu-text-3)]">
          {chapter.chapter_number}
        </span>
        {isNewest && readState.state === 'unread' && (
          <span
            className="absolute -top-1.5 -right-2 w-2 h-2 rounded-full
                       bg-[var(--ryu-primary)]"
          />
        )}
      </div>

      {/* Title + sub-label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--ryu-text)] truncate">
          {chapterLabel}
        </p>
        <div className="mt-0.5">
          <SubLabel />
        </div>
      </div>

      {/* Date + page count — hidden on small screens */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
        {chapter.published_at && (
          <span className="text-xs text-[var(--ryu-text-3)]">
            {formatDate(chapter.published_at)}
          </span>
        )}
        {chapter.page_count > 0 && (
          <span className="text-xs text-[var(--ryu-text-3)]">
            {chapter.page_count} pages
          </span>
        )}
      </div>

      {/* Bookmark star — only on in-progress chapter */}
      {readState.state === 'reading' && (
        <Star
          size={14}
          className="flex-shrink-0 fill-[var(--ryu-accent-deep)]
                     text-[var(--ryu-accent-deep)]"
        />
      )}

      {/* Action button */}
      <Link
        href={href}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold
                   tracking-wide hover:opacity-80 transition-opacity
                   whitespace-nowrap ${btn.cls}`}
      >
        {btn.label}
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChapterList({
  chapters,
  seriesId,
  seriesSlug,
  seriesDescription,
}: Props) {
  const [activeTab, setActiveTab]         = useState<Tab>('chapters')
  const [sortOrder, setSortOrder]         = useState<SortOrder>('desc')
  const [chapterStates, setChapterStates] = useState<Record<string, ChapterReadState>>({})

  // Load per-chapter read states from localStorage on mount
  useEffect(() => {
    try {
      const progressRaw = localStorage.getItem(`reading-progress-${seriesId}`)
      const progress = progressRaw
        ? (JSON.parse(progressRaw) as ReadingProgress)
        : null

      const states: Record<string, ChapterReadState> = {}

      for (const ch of chapters) {
        const isDone = localStorage.getItem(`ch-done-${ch.id}`) === 'true'

        if (isDone) {
          states[ch.id] = { state: 'read' }
        } else if (progress?.chapterId === ch.id) {
          states[ch.id] = {
            state: 'reading',
            currentPage: progress.currentPage,
            totalPages: progress.totalPages,
          }
        } else {
          states[ch.id] = { state: 'unread' }
        }
      }

      setChapterStates(states)
    } catch {
      // Silently ignore localStorage errors — defaults to all-unread
    }
  }, [seriesId, chapters])

  const sortedChapters = [...chapters].sort((a, b) =>
    sortOrder === 'asc'
      ? a.chapter_number - b.chapter_number
      : b.chapter_number - a.chapter_number
  )

  const newestChapterId =
    chapters.length > 0
      ? chapters.reduce((max, ch) =>
          ch.chapter_number > max.chapter_number ? ch : max
        ).id
      : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">

      {/* Continue reading bar — above tabs, only shown if progress exists */}
      <ContinueReadingBar seriesId={seriesId} seriesSlug={seriesSlug} />

      {/* Tab bar */}
      <div className="flex items-end border-b border-[var(--ryu-border)] mb-5">
        <TabButton
          active={activeTab === 'chapters'}
          onClick={() => setActiveTab('chapters')}
          label="CHAPTERS"
          count={chapters.length}
        />
        <TabButton
          active={activeTab === 'about'}
          onClick={() => setActiveTab('about')}
          label="Description"
        />
      </div>

      {/* ── CHAPTERS tab ── */}
      {activeTab === 'chapters' && (
        <div>
          {/* List header: count + sort toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--ryu-text-2)]">
              {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
            </p>

            {chapters.length > 1 && (
              <div className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setSortOrder('desc')}
                  className={`px-2 py-0.5 transition-colors ${
                    sortOrder === 'desc'
                      ? 'font-semibold text-[var(--ryu-text)]'
                      : 'text-[var(--ryu-text-3)] hover:text-[var(--ryu-text-2)]'
                  }`}
                >
                  Newest
                </button>
                <span className="text-[var(--ryu-border)]">|</span>
                <button
                  onClick={() => setSortOrder('asc')}
                  className={`px-2 py-0.5 transition-colors ${
                    sortOrder === 'asc'
                      ? 'font-semibold text-[var(--ryu-text)]'
                      : 'text-[var(--ryu-text-3)] hover:text-[var(--ryu-text-2)]'
                  }`}
                >
                  Oldest
                </button>
              </div>
            )}
          </div>

          {/* Chapter rows */}
          {chapters.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[var(--ryu-text-3)] text-sm">No chapters yet.</p>
              <p className="text-[var(--ryu-text-3)] text-xs mt-1">Check back soon.</p>
            </div>
          ) : (
            <div
              className="border border-[var(--ryu-border)] rounded-2xl overflow-hidden
                         bg-[var(--ryu-surface-1)]"
            >
              {sortedChapters.map((chapter, index) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  seriesSlug={seriesSlug}
                  readState={chapterStates[chapter.id] ?? { state: 'unread' }}
                  isNewest={chapter.id === newestChapterId}
                  isLast={index === sortedChapters.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABOUT tab ── */}
      {activeTab === 'about' && (
        <div className="py-4 max-w-2xl">
          {seriesDescription ? (
            <p className="text-[var(--ryu-text-2)] text-sm sm:text-base leading-relaxed">
              {seriesDescription}
            </p>
          ) : (
            <p className="text-[var(--ryu-text-3)] text-sm">No description available.</p>
          )}
        </div>
      )}

    </div>
  )
}