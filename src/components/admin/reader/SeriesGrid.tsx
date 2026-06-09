// src/components/reader/SeriesGrid.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import SeriesCard from '@/components/admin/reader/SeriesCard'
import type { Database } from '@/types/database'

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

// Which filters are status-based vs genre-based
const STATUS_FILTERS = ['all', 'ongoing', 'completed', 'new']

export default function SeriesGrid({ series, chapterCounts, stats }: SeriesGridProps) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [maxAge, setMaxAge] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('ryu-age')
    setMaxAge (stored !== null ? Number(stored) : 18)
  }, [])    

  // Derive unique genres from real data, preserving insertion order
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

  // All pill options: status pills first, then genre pills
  const pills = useMemo(() => [
    { id: 'all',       label: 'All' },
    { id: 'ongoing',   label: 'Ongoing' },
    { id: 'completed', label: 'Completed' },
    { id: 'new',       label: 'New' },
    ...genreFilters.map(g => ({ id: g.toLowerCase(), label: g, genre: g })),
  ], [genreFilters])

  const filtered = useMemo(() => {
    let r = series.filter(s => {
      // Age filter 
      const seriesAge = s.min_age && s.min_age > 0 ? s.min_age : null
      if (seriesAge !== null && maxAge !== null && seriesAge > maxAge) return false

      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const matchTitle = s.title.toLowerCase().includes(q)
        const matchGenre = s.genre?.toLowerCase().includes(q) ?? false
        if (!matchTitle && !matchGenre) return false
      }
      return true
    })

    // Active pill filter
    if (activeFilter === 'ongoing')   r = r.filter(s => s.status === 'ongoing')
    else if (activeFilter === 'completed') r = r.filter(s => s.status === 'completed')
    else if (activeFilter === 'new')  r = r.filter(s => (chapterCounts[s.id] ?? 0) > 0)
    else if (!STATUS_FILTERS.includes(activeFilter)) {
      // It's a genre filter — match the label back to genre value
      const matchGenre = genreFilters.find(g => g.toLowerCase() === activeFilter)
      if (matchGenre) r = r.filter(s => s.genre === matchGenre)
    }

    // Sort
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
      {/* ── Stats + search strip ─────────────────────────────────── */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
      >
        <div
          className="max-w-[1600px] mx-auto px-12 py-5 flex items-center justify-between gap-6 flex-wrap"
        >
          {/* Search */}
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
                fontFamily: "'Quicksand', system-ui, sans-serif",
              }}
            />
          </div>

          {/* Stats */}
          <div className="flex items-end gap-5 shrink-0">
            {[
              { value: stats.series,   label: 'series' },
              { value: stats.chapters, label: 'chapters' },
              { value: stats.pages.toLocaleString(), label: 'pages' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-end gap-0.5">
                <span
                  className="text-lg font-medium leading-none tabular-nums"
                  style={{ color: 'var(--ryu-text)' }}
                >
                  {value}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--ryu-text-muted)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter pills + sort ──────────────────────────────────── */}
      <div
        className="sticky top-[52px] z-30 border-b"
        style={{
          background: 'var(--ryu-bg)',
          borderColor: 'var(--ryu-border)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-12 py-3 flex items-center justify-between gap-4">
          {/* Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {pills.map(pill => (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                style={{
                  fontFamily: activeFilter === pill.id
                    ? "'Bangers', cursive"
                    : "'Quicksand', system-ui, sans-serif",
                  fontWeight: activeFilter === pill.id ? 400 : 600,
                  letterSpacing: activeFilter === pill.id ? '0.06em' : '0',
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

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="shrink-0 h-8 px-3 rounded-lg text-[11px] outline-none cursor-pointer"
            style={{
              border: '0.5px solid var(--ryu-border)',
              background: 'var(--ryu-bg)',
              color: 'var(--ryu-text-secondary)',
              fontFamily: "'Quicksand', system-ui, sans-serif",
              fontWeight: 500,
            }}
          >
            <option value="recent">Sort: Recent</option>
            <option value="az">Sort: A → Z</option>
            <option value="chapters">Sort: Most chapters</option>
          </select>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-12 py-6">
        {maxAge === null ? null : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-3 rounded-xl border"
            style={{ borderColor: 'var(--ryu-border)', color: 'var(--ryu-text-muted)' }}
          >
            <Search size={32} strokeWidth={1.5} />
            <p
              className="text-sm font-medium"
              style={{ fontFamily: "'Quicksand', sans-serif" }}
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