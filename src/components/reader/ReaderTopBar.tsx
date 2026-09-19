'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlignJustify, BookOpen, ChevronLeft, ChevronRight,Eye, EyeOff, List, X } from 'lucide-react'
import ThemeToggle from '@/components/shared/ThemeToggle'

type ReadMode = 'scroll' | 'flip'

type ChapterSummary = {
  id: string
  chapter_number: number
  title: string | null
  is_early_access: boolean | null
}

type Props = {
  seriesTitle: string
  seriesSlug: string
  chapterLabel: string
  currentChapterNumber: number
  allChapters: ChapterSummary[]
  mode: ReadMode
  onModeChange: (mode: ReadMode) => void
  visible: boolean
  onToggleVisibility: () => void
  prevHref: string | null
  nextHref: string | null
  totalPages: number
}

export default function ReaderTopBar({
  seriesTitle,
  seriesSlug,
  chapterLabel,
  currentChapterNumber,
  allChapters,
  mode,
  onModeChange,
  visible,
  onToggleVisibility,
  prevHref,
  nextHref,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // All colors are --ryu-* tokens, so the bar follows the site-wide theme
  // (the `.dark` class on <html>) with no reader-specific theme state.
  const bar          = 'bg-[var(--ryu-surface-1)] border-[var(--ryu-border)]'
  const mutedText    = 'text-[var(--ryu-text-2)]'
  const hoverText    = 'hover:text-[var(--ryu-text)]'
  const disabledText = 'text-[var(--ryu-text-3)] opacity-40'

  return (
    <>
      <header
        className={`
          sticky top-0 z-50 w-full border-b backdrop-blur-sm
          transition-transform duration-300
          ${bar}
          ${visible ? 'translate-y-0' : '-translate-y-full pointer-events-none'}
        `}
        // relative so the picker panel positions against this header
        style={{ position: 'sticky' }}
      >
        <div className="flex h-12 items-center gap-2 px-3">

          {/* Back */}
          <Link
            href={`/comics/${seriesSlug}`}
            onClick={e => e.stopPropagation()}
            className={`flex-shrink-0 p-1.5 transition-colors ${mutedText} ${hoverText}`}
            aria-label="Back to series"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Titles + chapter picker trigger */}
          <button
            onClick={e => { e.stopPropagation(); setPickerOpen(v => !v) }}
            aria-label="Chapter list"
            className="flex-1 min-w-0 text-left group flex items-center gap-1.5 rounded-md px-1
                        transition-colors hover:bg-[var(--ryu-surface-3)]"
          >
            <div className="flex-1 min-w-0">
              <p className={`truncate text-xs leading-none mb-0.5 ${mutedText}`}>
                {seriesTitle}
              </p>
              <p className="truncate text-sm font-medium leading-none text-[var(--ryu-text)]">
                {chapterLabel}
              </p>
            </div>
            {/* Dropdown chevron — subtle, shows intent */}
            <List
              size={14}
              className={`flex-shrink-0 transition-colors ${
                pickerOpen ? 'text-[var(--ryu-primary)]' : mutedText
              }`}
            />
          </button>

          {/* Right controls */}
          <div className="flex-shrink-0 flex items-center gap-0.5">

            {/* Prev chapter */}
            {prevHref ? (
              <Link href={prevHref} onClick={e => e.stopPropagation()}
                className={`p-2 transition-colors ${mutedText} ${hoverText}`}
                aria-label="Previous chapter">
                <ChevronLeft size={18} />
              </Link>
            ) : (
              <span className={`p-2 ${disabledText}`}><ChevronLeft size={18} /></span>
            )}

            {/* Next chapter */}
            {nextHref ? (
              <Link href={nextHref} onClick={e => e.stopPropagation()}
                className={`p-2 transition-colors ${mutedText} ${hoverText}`}
                aria-label="Next chapter">
                <ChevronRight size={18} />
              </Link>
            ) : (
              <span className={`p-2 ${disabledText}`}><ChevronRight size={18} /></span>
            )}

            {/* Mode toggle */}
            <div
              className="flex items-center rounded-md border p-0.5 ml-1 border-[var(--ryu-border)] bg-[var(--ryu-surface-2)]"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => onModeChange('scroll')}
                aria-label="Scroll mode"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === 'scroll'
                    ? 'bg-[var(--ryu-text)] text-background'
                    : `${mutedText} ${hoverText}`
                }`}
              >
                <AlignJustify size={13} />
                <span className="hidden sm:inline">Scroll</span>
              </button>
              <button
                onClick={() => onModeChange('flip')}
                aria-label="Flip mode"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === 'flip'
                    ? 'bg-[var(--ryu-text)] text-background'
                    : `${mutedText} ${hoverText}`
                }`}
              >
                <BookOpen size={13} />
                <span className="hidden sm:inline">Flip</span>
              </button>
            </div>

            {/* Light/Dark toggle — same site-wide state as the navbar toggle */}
            <ThemeToggle
              variant="icon"
              className={`p-2 transition-colors ${mutedText} ${hoverText}`}
            />

            {/* Hide UI */}
            <button
              onClick={e => { e.stopPropagation(); onToggleVisibility() }}
              aria-label="Hide UI"
              className={`p-2 transition-colors ${mutedText} ${hoverText}`}
            >
              <EyeOff size={18} />
            </button>

          </div>
        </div>

        {/* ── Chapter picker panel ─────────────────────────────────────────── */}
        {pickerOpen && (
          <div
            className="absolute left-0 right-0 border-b overflow-y-auto bg-[var(--ryu-surface-1)] border-[var(--ryu-border)]"
            style={{ top: '100%', maxHeight: 'min(60vh, 380px)', zIndex: 40 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ryu-border-soft)]">
              <span className={`text-xs font-semibold uppercase tracking-wider ${mutedText}`}>
                {allChapters.length} Chapter{allChapters.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setPickerOpen(false)}
                className={`p-1 rounded transition-colors ${mutedText} ${hoverText}`}
                aria-label="Close chapter list"
              >
                <X size={14} />
              </button>
            </div>

            {/* Chapter rows */}
            {allChapters.map(ch => {
              const isCurrent = ch.chapter_number === currentChapterNumber
              const label = ch.title
                ? `Ch. ${ch.chapter_number} — ${ch.title}`
                : `Chapter ${ch.chapter_number}`

              return (
                <Link
                  key={ch.id}
                  href={`/comics/${seriesSlug}/${ch.chapter_number}`}
                  onClick={() => setPickerOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-[var(--ryu-border-soft)] last:border-0 ${
                    isCurrent
                      ? 'bg-[var(--ryu-primary-soft)] text-[var(--ryu-primary-deep)] font-medium'
                      : 'text-[var(--ryu-text-2)] hover:bg-[var(--ryu-surface-3)] hover:text-[var(--ryu-text)]'
                  }`}
                >
                  {/* Current indicator dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity ${
                      isCurrent ? 'bg-[var(--ryu-primary)] opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {/* Chapter number badge for quick scanning */}
                  {!isCurrent && (
                    <span className={`text-xs flex-shrink-0 ${mutedText}`}>
                      {ch.chapter_number}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </header>

      {/* Floating show-UI button */}
      {!visible && (
        <button
          onClick={e => { e.stopPropagation(); onToggleVisibility() }}
          aria-label="Show UI"
          className="fixed top-3 right-3 z-50 flex items-center justify-center
                     w-8 h-8 rounded-full border backdrop-blur-sm transition-colors
                     bg-[var(--ryu-surface-1)]/80 border-[var(--ryu-border)]
                     text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
        >
          <Eye size={20} />
        </button>
      )}
    </>
  )
}