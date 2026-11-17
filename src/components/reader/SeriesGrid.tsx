'use client'

import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SeriesCard from '@/components/reader/SeriesCard'
import type { Database } from '@/types/database'
import BookmarksNavLink from '@/components/shared/BookmarksNavLink'
import { useMaxAge } from '@/hooks/useSavedAge'
import { ALL_AGES, fitsAge } from '@/lib/age'

type Series = Database['public']['Tables']['series']['Row']
type ChapterCounts = Record<string, number>

interface Stats {
  series: number
  chapters: number
  pages: number
}

interface SeriesGridProps {
  series: Series[]
  chapterCounts: ChapterCounts
  stats: Stats
}

type StatusFilter = 'all' | 'ongoing' | 'completed' | 'new'

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'ongoing',   label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'new',       label: 'New' },
]

const FONT = 'var(--font-fredoka), sans-serif'

type Pill = { id: string; label: string; active: boolean; select: () => void }
type PillGroup = { key: string; label: string; hint?: string; pills: Pill[] }

/**
 * One filter choice. Same look in the desktop bar and the phone sheet.
 *
 * @param active - selected; announced with aria-pressed
 * @param large - 40px tall version for fingers (the phone sheet)
 */
function FilterPill({ active, large = false, onClick, children }: {
  active: boolean
  large?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // motion-pop: a small bounce when the pill becomes active (globals.css, "Reader motion")
      className={`rounded-full ${large ? 'px-4 min-h-10 text-[13px]' : 'px-3 py-1'} ${active ? 'motion-pop' : ''}`}
      style={{
        fontFamily: FONT,
        fontWeight: active ? 600 : 500,
        letterSpacing: active ? '0.02em' : '0',
        textTransform: active ? 'uppercase' : 'none',
        ...(large ? {} : { fontSize: active ? '12px' : '11px' }),
        border: active ? '0.5px solid var(--ryu-primary)' : '0.5px solid var(--ryu-border)',
        background: active ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)' : 'transparent',
        color: active ? 'var(--ryu-primary)' : 'var(--ryu-text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Comics list: search, filters, sort, grid.
 *
 * Filters are three separate questions that combine (status AND genre AND
 * age rating), not one list where picking a genre drops the status:
 * - Status: one of All / Ongoing / Completed / New.
 * - Genre: the genres of the comics this reader can see; tap again to clear.
 * - Age rating: only the ratings at or below the age the reader picked at the
 *   age gate, and only shown when there is more than one to choose from.
 *
 * Desktop shows the groups inline in the sticky bar. A phone shows a Filter
 * button that opens a bottom sheet; the sheet stays open while choosing and
 * its button says how many comics match.
 */
export default function SeriesGrid({ series, chapterCounts }: SeriesGridProps) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [genre, setGenre] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  // all ages -> saved age once read
  const maxAge = useMaxAge()
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  // While the sheet is open: the page behind doesn't scroll, Esc closes it,
  // and widening past the phone breakpoint closes it (the sheet is hidden there).
  useEffect(() => {
    if (!sheetOpen) return
    const close = () => setSheetOpen(false)
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const wide = window.matchMedia('(min-width: 40rem)')
    const onWide = () => { if (wide.matches) close() }

    const pageOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    wide.addEventListener('change', onWide)
    sheetRef.current?.focus()

    return () => {
      document.body.style.overflow = pageOverflow
      document.removeEventListener('keydown', onKeyDown)
      wide.removeEventListener('change', onWide)
    }
  }, [sheetOpen])

  // the age gate rule comes first: everything below only ever sees these
  const allowed = useMemo(
    () => series.filter(s => fitsAge(s.min_age, maxAge)),
    [series, maxAge]
  )

  const genreOptions = useMemo(
    () => [...new Set(allowed.map(s => s.genre).filter((g): g is string => !!g))],
    [allowed]
  )

  // ratings present among the allowed comics, lowest first (null counts as 13+)
  const ratingOptions = useMemo(
    () => [...new Set(allowed.map(s => s.min_age ?? ALL_AGES))].sort((a, b) => a - b),
    [allowed]
  )

  // a choice that no longer exists (the saved age changed) counts as not set
  const activeGenre  = genre !== null && genreOptions.includes(genre) ? genre : null
  const activeRating = rating !== null && ratingOptions.includes(rating) ? rating : null
  const activeCount  = (status !== 'all' ? 1 : 0) + (activeGenre ? 1 : 0) + (activeRating !== null ? 1 : 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const r = allowed.filter(s => {
      if (q && !s.title.toLowerCase().includes(q) && !(s.genre?.toLowerCase().includes(q) ?? false)) return false
      if (status === 'ongoing'   && s.status !== 'ongoing')   return false
      if (status === 'completed' && s.status !== 'completed') return false
      if (status === 'new'       && (chapterCounts[s.id] ?? 0) === 0) return false
      if (activeGenre && s.genre !== activeGenre) return false
      if (activeRating !== null && (s.min_age ?? ALL_AGES) !== activeRating) return false
      return true
    })

    if (sort === 'recent') {
      r.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    } else if (sort === 'az') {
      r.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === 'chapters') {
      r.sort((a, b) => (chapterCounts[b.id] ?? 0) - (chapterCounts[a.id] ?? 0))
    }
    return r
  }, [allowed, status, activeGenre, activeRating, sort, search, chapterCounts])

  function clearFilters() {
    setStatus('all'); setGenre(null); setRating(null)
  }

  const groups: PillGroup[] = [
    {
      key: 'status', label: 'Status',
      pills: STATUS_OPTIONS.map(o => ({ id: o.id, label: o.label, active: status === o.id, select: () => setStatus(o.id) })),
    },
    ...(genreOptions.length > 0 ? [{
      key: 'genre', label: 'Genre',
      pills: genreOptions.map(g => ({ id: g, label: g, active: activeGenre === g, select: () => setGenre(activeGenre === g ? null : g) })),
    }] : []),
    // one rating to choose from is not a choice
    ...(ratingOptions.length > 1 ? [{
      key: 'rating', label: 'Age rating', hint: 'Only ratings for the age you picked are listed.',
      pills: ratingOptions.map(r => ({ id: String(r), label: `${r}+`, active: activeRating === r, select: () => setRating(activeRating === r ? null : r) })),
    }] : []),
  ]

  return (
    <div>
      <div
        className="border-b"
        style={{ borderColor: 'var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-12 py-5 flex items-center gap-6 flex-wrap">
          <div className="relative flex-1 max-w-[520px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--ryu-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search comics by title or genre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-4 rounded-lg text-sm outline-none transition-colors"
              style={{
                border: '0.5px solid var(--ryu-border)',
                background: 'var(--ryu-bg)',
                color: 'var(--ryu-text)',
                fontFamily: FONT,
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="sticky top-[52px] z-30 border-b"
        style={{ background: 'var(--ryu-surface-1)', borderColor: 'var(--ryu-border)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-12 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* 640px and up: every group inline, a thin rule between groups */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {groups.map((group, i) => (
              <Fragment key={group.key}>
                {i > 0 && (
                  <span aria-hidden="true" className="w-px h-4 mx-1" style={{ background: 'var(--ryu-border)' }} />
                )}
                <div role="group" aria-label={group.label} className="flex items-center gap-2 flex-wrap">
                  {group.pills.map(pill => (
                    <FilterPill key={pill.id} active={pill.active} onClick={pill.select}>{pill.label}</FilterPill>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>

          {/* phone: one button that says what it does. 44px tall tap target, 32px visible */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-label={activeCount > 0 ? `Filter comics, ${activeCount} active` : 'Filter comics'}
            className="sm:hidden -my-1.5 h-11 shrink-0 flex items-center"
          >
            <span
              className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs"
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                border: activeCount > 0 ? '0.5px solid var(--ryu-primary)' : '0.5px solid var(--ryu-border)',
                background: activeCount > 0 ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)' : 'transparent',
                color: activeCount > 0 ? 'var(--ryu-primary)' : 'var(--ryu-text-secondary)',
              }}
            >
              <SlidersHorizontal size={14} />
              {/* the word needs room: from 400px, next to Bookmarks and Sort */}
              <span className="hidden min-[400px]:inline">Filter</span>
              {activeCount > 0 && (
                <span
                  className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)' }}
                >
                  {activeCount}
                </span>
              )}
            </span>
          </button>

          {/* share the width left by the filter button */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 sm:flex-none sm:shrink-0">
            <BookmarksNavLink allSeries={series} className="grow shrink-0 justify-center sm:grow-0" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="grow min-w-[6.75rem] sm:grow-0 sm:min-w-0 sm:shrink-0 h-8 px-3 rounded-lg text-[11px] outline-none cursor-pointer"
              style={{
                border: '0.5px solid var(--ryu-border)',
                background: 'var(--ryu-bg)',
                color: 'var(--ryu-text-secondary)',
                fontFamily: FONT,
                fontWeight: 500,
              }}
            >
              <option value="recent">Sort: Recent</option>
              <option value="az">Sort: A → Z</option>
              <option value="chapters">Sort: Most chapters</option>
            </select>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div
          className="motion-fade sm:hidden fixed inset-0 z-50 flex items-end"
          style={{ background: 'color-mix(in srgb, var(--ryu-shadow) 50%, transparent)' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filter comics"
            tabIndex={-1}
            className="motion-sheet w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pt-3 outline-none"
            style={{
              background: 'var(--ryu-surface-1)',
              borderTop: '0.5px solid var(--ryu-border)',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              aria-hidden="true"
              className="w-8 h-1 rounded-full mx-auto mb-1"
              style={{ background: 'var(--ryu-border)' }}
            />

            <div className="flex items-center justify-between">
              <h2 className="text-base" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--ryu-text)' }}>
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="-mr-2.5 w-11 h-11 flex items-center justify-center"
                style={{ color: 'var(--ryu-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 pt-1">
              {groups.map(group => (
                <div key={group.key} role="group" aria-label={group.label}>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--ryu-text-muted)' }}
                  >
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.pills.map(pill => (
                      <FilterPill key={pill.id} large active={pill.active} onClick={pill.select}>{pill.label}</FilterPill>
                    ))}
                  </div>
                  {group.hint && (
                    <p className="text-[11px] mt-2" style={{ color: 'var(--ryu-text-muted)' }}>{group.hint}</p>
                  )}
                </div>
              ))}
            </div>

            {/* the sheet stays open while choosing; this button closes it and says what you'll get */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={clearFilters}
                disabled={activeCount === 0}
                className="h-11 px-3 text-[13px] disabled:opacity-40"
                style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--ryu-text-secondary)' }}
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 h-11 rounded-xl text-sm"
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  background: 'var(--ryu-primary)',
                  color: 'var(--ryu-on-primary)',
                  border: '1px solid var(--ryu-primary-deep)',
                }}
              >
                {filtered.length === 0
                  ? 'No comics match'
                  : `Show ${filtered.length} comic${filtered.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-12 py-6">
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-3 rounded-xl border"
            style={{ borderColor: 'var(--ryu-border)', color: 'var(--ryu-text-muted)' }}
          >
            <Search size={32} strokeWidth={1.5} />
            <p className="text-sm font-medium" style={{ fontFamily: FONT }}>
              {series.length === 0 ? 'No comics published yet' : 'No results found'}
            </p>
            {series.length > 0 && (
              <button
                type="button"
                onClick={() => { clearFilters(); setSearch('') }}
                className="text-xs underline"
                style={{ color: 'var(--ryu-primary)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map(s => (
              <SeriesCard
                key={s.id}
                series={s}
                chapterCount={chapterCounts[s.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
