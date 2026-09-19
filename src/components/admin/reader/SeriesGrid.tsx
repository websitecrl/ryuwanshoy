'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Menu, X } from 'lucide-react'
import SeriesCard from '@/components/admin/reader/SeriesCard'
import type { Database } from '@/types/database'
import BookmarksNavLink from '@/components/shared/BookmarksNavLink'

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

const STATUS_FILTERS = ['all', 'ongoing', 'completed', 'new']

export default function SeriesGrid({ series, chapterCounts, stats }: SeriesGridProps) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [maxAge, setMaxAge] = useState<number | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ryu-age')
    setMaxAge(stored !== null ? Number(stored) : 18)
  }, [])

  useEffect(() => {
    if (filterSheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [filterSheetOpen])

  const genreFilters = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const s of series) {
      if (s.genre && !seen.has(s.genre)) {
        seen.add(s.genre)
        result.push(s.genre)
      }
    }
    return result
  }, [series])

  const pills = useMemo(() => [
    { id: 'all',       label: 'All' },
    { id: 'ongoing',   label: 'Ongoing' },
    { id: 'completed', label: 'Completed' },
    { id: 'new',       label: 'New' },
    ...genreFilters.map(g => ({ id: g.toLowerCase(), label: g, genre: g })),
  ], [genreFilters])

  const filtered = useMemo(() => {
    let r = series.filter(s => {
      const seriesAge = s.min_age && s.min_age > 0 ? s.min_age : null
      if (seriesAge !== null && maxAge !== null && seriesAge > maxAge) return false
      if (search) {
        const q = search.toLowerCase()
        const matchTitle = s.title.toLowerCase().includes(q)
        const matchGenre = s.genre?.toLowerCase().includes(q) ?? false
        if (!matchTitle && !matchGenre) return false
      }
      return true
    })

    if (activeFilter === 'ongoing')        r = r.filter(s => s.status === 'ongoing')
    else if (activeFilter === 'completed') r = r.filter(s => s.status === 'completed')
    else if (activeFilter === 'new')       r = r.filter(s => (chapterCounts[s.id] ?? 0) > 0)
    else if (!STATUS_FILTERS.includes(activeFilter)) {
      const matchGenre = genreFilters.find(g => g.toLowerCase() === activeFilter)
      if (matchGenre) r = r.filter(s => s.genre === matchGenre)
    }

    if (sort === 'recent') {
      r = [...r].sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      )
    } else if (sort === 'az') {
      r = [...r].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === 'chapters') {
      r = [...r].sort((a, b) => (chapterCounts[b.id] ?? 0) - (chapterCounts[a.id] ?? 0))
    }

    return r
  }, [series, activeFilter, sort, search, genreFilters, chapterCounts, maxAge])

  return (
    <div>
      {/* ── Search strip ─────────────────────────────────── */}
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
                fontFamily: "var(--font-fredoka), sans-serif",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter pills (desktop) + burger (mobile) + Bookmarks + Sort ──────────────────────────────────── */}
      <div
        className="sticky top-[52px] z-30 border-b"
        style={{ background: 'var(--ryu-surface-1)', borderColor: 'var(--ryu-border)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-12 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Pills — desktop */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {pills.map(pill => (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                style={{
                  fontFamily: "var(--font-fredoka), sans-serif",
                  fontWeight: activeFilter === pill.id ? 600 : 500,
                  letterSpacing: activeFilter === pill.id ? '0.02em' : '0',
                  textTransform: activeFilter === pill.id ? 'uppercase' as const : 'none' as const,
                  fontSize: activeFilter === pill.id ? '12px' : '11px',
                  border: activeFilter === pill.id
                    ? '0.5px solid var(--ryu-primary)'
                    : '0.5px solid var(--ryu-border)',
                  background: activeFilter === pill.id
                    ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)'
                    : 'transparent',
                  color: activeFilter === pill.id
                    ? 'var(--ryu-primary)'
                    : 'var(--ryu-text-secondary)',
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Burger — mobile only. The button is the 44×44 tap target; the
              32×32 span inside is what you see. -ml-1.5 pulls the visible edge
              flush with the search bar's inset, and -my-1.5 keeps the taller
              hit area from making the sticky row any taller. */}
          <button
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Filter comics"
            className="sm:hidden -ml-1.5 -my-1.5 w-11 h-11 shrink-0 flex items-center justify-center"
            style={{ color: 'var(--ryu-text-secondary)' }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ border: '0.5px solid var(--ryu-border)' }}
            >
              <Menu size={15} />
            </span>
          </button>

          {/* Bookmarks + Sort — on mobile they split whatever width the burger
              leaves over; the select can shrink toward its min-width but never
              below what "Sort: Recent" needs. */}
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
                fontFamily: "var(--font-fredoka), sans-serif",
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

      {/* ── Mobile filter bottom sheet ──────────────────────────────────── */}
      {filterSheetOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setFilterSheetOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl px-4 pt-3 pb-6"
            style={{ background: 'var(--ryu-surface-1)', borderTop: '0.5px solid var(--ryu-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="w-8 h-1 rounded-full mx-auto mb-3"
              style={{ background: 'var(--ryu-border)' }}
            />

            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--ryu-text-muted)' }}
              >
                Filter
              </span>
              <button onClick={() => setFilterSheetOpen(false)} style={{ color: 'var(--ryu-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {pills.map(pill => (
                <button
                  key={pill.id}
                  onClick={() => { setActiveFilter(pill.id); setFilterSheetOpen(false) }}
                  className="rounded-full px-3 py-1.5 text-xs transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-fredoka), sans-serif",
                    fontWeight: activeFilter === pill.id ? 600 : 500,
                    letterSpacing: activeFilter === pill.id ? '0.02em' : '0',
                    textTransform: activeFilter === pill.id ? 'uppercase' as const : 'none' as const,
                    border: activeFilter === pill.id
                      ? '0.5px solid var(--ryu-primary)'
                      : '0.5px solid var(--ryu-border)',
                    background: activeFilter === pill.id
                      ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)'
                      : 'transparent',
                    color: activeFilter === pill.id
                      ? 'var(--ryu-primary)'
                      : 'var(--ryu-text-secondary)',
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-12 py-6">
        {maxAge === null ? null : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-3 rounded-xl border"
            style={{ borderColor: 'var(--ryu-border)', color: 'var(--ryu-text-muted)' }}
          >
            <Search size={32} strokeWidth={1.5} />
            <p
              className="text-sm font-medium"
              style={{ fontFamily: "var(--font-fredoka), sans-serif" }}
            >
              {series.length === 0 ? 'No comics published yet' : 'No results found'}
            </p>
            {series.length > 0 && (
              <button
                onClick={() => { setActiveFilter('all'); setSearch('') }}
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