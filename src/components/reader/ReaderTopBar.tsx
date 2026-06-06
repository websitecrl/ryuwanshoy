'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bookmark, BookmarkCheck,
  AlignJustify, BookOpen,
  ChevronLeft, ChevronRight,
  Eye, EyeOff, Sun, Moon,
  List, X,
} from 'lucide-react'

type ReadMode = 'scroll' | 'flip'
export type ReaderTheme = 'dark' | 'light'

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
  bookmarked: boolean
  onBookmark: () => void
  visible: boolean
  onToggleVisibility: () => void
  prevHref: string | null
  nextHref: string | null
  totalPages: number
  theme: ReaderTheme
  onThemeChange: (theme: ReaderTheme) => void
}

export default function ReaderTopBar({
  seriesTitle,
  seriesSlug,
  chapterLabel,
  currentChapterNumber,
  allChapters,
  mode,
  onModeChange,
  bookmarked,
  onBookmark,
  visible,
  onToggleVisibility,
  prevHref,
  nextHref,
  theme,
  onThemeChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const isLight = theme === 'light'

  const bar          = isLight ? 'bg-[#FFFBF5] border-[#FED7AA]'         : 'bg-[#0a0a0a] border-[rgba(255,255,255,0.1)]'
  const mutedText    = isLight ? 'text-[var(--ryu-text-3)]'               : 'text-neutral-400'
  const hoverText    = isLight ? 'hover:text-[var(--ryu-text)]'           : 'hover:text-white'
  const disabledText = isLight ? 'text-[var(--ryu-border)]'               : 'text-neutral-700'

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
            className={`flex-1 min-w-0 text-left group flex items-center gap-1.5 rounded-md px-1
                        transition-colors ${isLight ? 'hover:bg-[var(--ryu-surface-3)]' : 'hover:bg-white/5'}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`truncate text-xs leading-none mb-0.5 ${mutedText}`}>
                {seriesTitle}
              </p>
              <p className={`truncate text-sm font-medium leading-none ${isLight ? 'text-[var(--ryu-text)]' : 'text-white'}`}>
                {chapterLabel}
              </p>
            </div>
            {/* Dropdown chevron — subtle, shows intent */}
            <List
              size={14}
              className={`flex-shrink-0 transition-colors ${
                pickerOpen
                  ? isLight ? 'text-[var(--ryu-primary)]' : 'text-white'
                  : mutedText
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
              className={`flex items-center rounded-md border p-0.5 ml-1 ${
                isLight
                  ? 'border-[var(--ryu-border)] bg-[var(--ryu-surface-2)]'
                  : 'border-white/10 bg-neutral-900'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => onModeChange('scroll')}
                aria-label="Scroll mode"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === 'scroll'
                    ? isLight ? 'bg-[var(--ryu-text)] text-white' : 'bg-white text-neutral-950'
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
                    ? isLight ? 'bg-[var(--ryu-text)] text-white' : 'bg-white text-neutral-950'
                    : `${mutedText} ${hoverText}`
                }`}
              >
                <BookOpen size={13} />
                <span className="hidden sm:inline">Flip</span>
              </button>
            </div>

            {/* Light/Dark toggle */}
            <button
              onClick={e => { e.stopPropagation(); onThemeChange(isLight ? 'dark' : 'light') }}
              aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              className={`p-2 transition-colors ${mutedText} ${hoverText}`}
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Bookmark */}
            <button
              onClick={e => { e.stopPropagation(); onBookmark() }}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
              className={`p-2 transition-colors ${
                bookmarked ? 'text-yellow-400 hover:text-yellow-300' : `${mutedText} ${hoverText}`
              }`}
            >
              {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>

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
            className={`absolute left-0 right-0 border-b overflow-y-auto ${
              isLight
                ? 'bg-[var(--ryu-surface-1)] border-[var(--ryu-border)]'
                : 'bg-[#0a0a0a] border-white/10'
            }`}
            style={{ top: '100%', maxHeight: 'min(60vh, 380px)', zIndex: 40 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
              isLight ? 'border-[var(--ryu-border-soft)]' : 'border-white/5'
            }`}>
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
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b last:border-0 ${
                    isLight ? 'border-[var(--ryu-border-soft)]' : 'border-white/5'
                  } ${
                    isCurrent
                      ? isLight
                        ? 'bg-[var(--ryu-primary-soft)] text-[var(--ryu-primary-deep)] font-medium'
                        : 'bg-white/8 text-white font-medium'
                      : isLight
                        ? 'text-[var(--ryu-text-2)] hover:bg-[var(--ryu-surface-3)] hover:text-[var(--ryu-text)]'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {/* Current indicator dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity ${
                      isCurrent
                        ? isLight ? 'bg-[var(--ryu-primary)] opacity-100' : 'bg-white opacity-100'
                        : 'opacity-0'
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
          className={`fixed top-3 right-3 z-50 flex items-center justify-center
                     w-8 h-8 rounded-full border backdrop-blur-sm transition-colors ${
                       isLight
                         ? 'bg-[#FFFBF5]/80 border-[var(--ryu-border)] text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]'
                         : 'bg-neutral-900/80 border-white/10 text-neutral-400 hover:text-white'
                     }`}
        >
          <Eye size={15} />
        </button>
      )}
    </>
  )
}