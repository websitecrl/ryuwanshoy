'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, BookOpen, Search, BookMarked } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { timeAgo } from '@/lib/time'
import type { Tables } from '@/types/database'

type Series = Tables<'series'>

// ── Helpers ────────────────────────────────────────────────────────────────

// Generate a stable gradient from the series title (no image = show initials on gradient)
function titleToGradient(title: string): string {
  const palettes = [
    ['#3D1A0E', '#7C2D12'],
    ['#1A1A3E', '#312E81'],
    ['#0F2A1A', '#14532D'],
    ['#2A0A2E', '#581C87'],
    ['#1A2A0A', '#365314'],
    ['#0A1A2A', '#1E3A5F'],
    ['#2A1A0A', '#78350F'],
    ['#1A0A2A', '#4C1D95'],
  ] as const

  const idx = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % palettes.length
  const palette = palettes[idx]!
  const from = palette[0]
  const to   = palette[1]
  return `linear-gradient(145deg, ${from} 0%, ${to} 100%)`
}

// Get initials — up to 2 characters from first letters of words
function getInitials(title: string): string {
  return title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('')
}

// ── Types ──────────────────────────────────────────────────────────────────

// The API may return chapters count — we handle both shapes
type SeriesWithCount = Series & { chapter_count?: number }

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminSeriesPage() {
  const [series, setSeries]       = useState<SeriesWithCount[]>([])
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<'all' | 'ongoing' | 'completed' | 'hiatus'>('all')

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSeries() {
      const res  = await fetch('/api/series')
      const json = await res.json()
      if (!res.ok) { toast.error('Failed to load series') }
      else { setSeries(Array.isArray(json) ? json : json.data ?? []) }
      setLoading(false)
    }
    fetchSeries()
  }, [])

  // ── Delete ─────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(id)
    const res  = await fetch(`/api/series/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.error) { toast.error(json.error) }
    else { setSeries(prev => prev.filter(s => s.id !== id)); toast.success('Series deleted') }
    setDeleting(null)
  }

  // ── Filter in memory ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return series.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
                            (s.genre ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [series, search, statusFilter])

  // Counts for filter pills
  const counts = useMemo(() => ({
    all:       series.length,
    ongoing:   series.filter(s => s.status === 'ongoing').length,
    completed: series.filter(s => s.status === 'completed').length,
    hiatus:    series.filter(s => s.status === 'hiatus').length,
  }), [series])

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8">
        {/* Header skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
          <div className="h-10 w-32 rounded-lg animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
          <div className="h-4 w-72 rounded animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
        </div>
        {/* Search + pills skeleton */}
        <div className="flex gap-3 mb-6">
          <div className="h-10 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
          {[1,2,3].map(n => <div key={n} className="h-10 w-24 rounded-full animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />)}
          <div className="h-10 w-32 rounded-lg animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
              <div className="h-52 animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 rounded animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
                <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: 'var(--ryu-surface-3)' }} />
                <div className="h-9 rounded-lg animate-pulse mt-3" style={{ background: 'var(--ryu-surface-3)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8 animate-page-in">

      {/* ── Page header — title block only, button moved to the search row below ── */}
      <div className="mb-8">
        <div
          className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
          style={{ color: 'var(--ryu-primary-deep)' }}
        >
          Library · {series.length} title{series.length !== 1 ? 's' : ''}
        </div>
        <h1
          className="font-heading font-bold leading-tight"
          style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)' }}
        >
          Series
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>
          Every story in your shelf. Tap a card to manage chapters, cover.
        </p>
      </div>

      {/* ── Search + filter pills + New Series button ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" style={{ minWidth: 360 }}>
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--ryu-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by title, genre, or author..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-4 rounded-lg text-sm outline-none"
              style={{
                border: '1px solid var(--ryu-border)',
                background: 'var(--ryu-surface-2)',
                color: 'var(--ryu-text)',
                fontFamily: "'Quicksand', system-ui, sans-serif",
              }}
            />
          </div>

          {/* Filter pills */}
          {(['all', 'ongoing', 'completed', 'hiatus'] as const)
              .filter(s => s === 'all' || counts[s] > 0)
              .map(status => (
                <button
                  key={status}
                  onClick={() => setStatus(status)}
                  className="flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-colors capitalize"
                  style={
                    statusFilter === status
                      ? {
                          background: 'var(--ryu-primary)',
                          color: '#fff',
                          border: '1.5px solid var(--ryu-primary-deep)',
                        }
                      : {
                          background: 'var(--ryu-surface-1)',
                          color: 'var(--ryu-text-2)',
                          border: '1.5px solid var(--ryu-border)',
                        }
                  }
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
                    style={
                      statusFilter === status
                        ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                        : { background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-2)' }
                    }
                  >
                    {counts[status]}
                  </span>
                </button>
              ))}
        </div>

        <Link
          href="/admin/series/new"
          className="flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-semibold shrink-0 transition-opacity hover:opacity-90"
          style={{
            background: '#FEF08A',
            color: '#1E1E1E',
            border: '1px solid #D4B800',
            boxShadow: '0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Series
        </Link>
      </div>

      {/* ── Empty state — no series at all ───────────────────────────── */}
      {series.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl p-16 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
        >
          <span
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}
          >
            <BookOpen size={28} />
          </span>
          <div className="font-heading font-semibold text-xl mb-1" style={{ color: 'var(--ryu-text)' }}>
            No series yet
          </div>
          <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--ryu-text-2)' }}>
            Create your first comic series to get started. All your stories will live here.
          </p>
          <Link
            href="/admin/series/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)' }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Create first series
          </Link>
        </div>

      ) : filtered.length === 0 ? (
        /* ── Empty state — no search results ── */
        <div
          className="flex flex-col items-center justify-center rounded-2xl p-12 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
        >
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-3)' }}
          >
            <Search size={22} />
          </span>
          <div className="font-heading font-semibold text-lg mb-1" style={{ color: 'var(--ryu-text)' }}>
            No results
          </div>
          <p className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>
            No series match &ldquo;{search}&rdquo;. Try a different search.
          </p>
        </div>

      ) : (
        /* ── Series card grid ── */
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              deleting={deleting === s.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Series Card ────────────────────────────────────────────────────────────

interface SeriesCardProps {
  series: SeriesWithCount
  deleting: boolean
  onDelete: (id: string) => void
}

function SeriesCard({ series: s, deleting, onDelete }: SeriesCardProps) {
  const chapterCount = s.chapter_count ?? 0

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-shadow hover:shadow-lg"
      style={{
        border: '1px solid var(--ryu-border)',
        background: 'var(--ryu-surface-1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Cover area ── */}
      <div className="relative overflow-hidden" style={{ height: 210 }}>

        {s.cover_image ? (
          <Image
            src={s.cover_image}
            alt={s.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          /* Gradient fallback with initials */
          <div
            className="w-full h-full flex items-end justify-start p-4"
            style={{ background: titleToGradient(s.title) }}
          >
            <span
              className="font-heading font-bold select-none"
              style={{ fontSize: 56, lineHeight: 1, color: 'rgba(255,255,255,0.15)', letterSpacing: -2 }}
            >
              {getInitials(s.title)}
            </span>
          </div>
        )}

        {/* Status badge — top right */}
        <div className="absolute top-3 right-3">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={
              s.status === 'ongoing'
                ? { background: 'rgba(22,163,74,0.92)', color: '#fff', backdropFilter: 'blur(4px)' }
                : s.status === 'completed'
                ? { background: 'rgba(100,116,139,0.88)', color: '#fff', backdropFilter: 'blur(4px)' }
                : { background: 'rgba(217,119,6,0.88)', color: '#fff', backdropFilter: 'blur(4px)' }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: s.status === 'ongoing' ? '#86EFAC' : s.status === 'completed' ? '#CBD5E1' : '#FDE68A' }}
            />
            {s.status === 'ongoing' ? 'Ongoing' : s.status === 'completed' ? 'Completed' : 'Hiatus'}
          </span>
        </div>

        {/* Chapter count badge — bottom left */}
        <div className="absolute bottom-3 left-3">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            <BookMarked size={12} />
            {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Title + meta */}
        <div>
          <h2
            className="font-heading font-semibold text-base leading-snug mb-.5"
            style={{ color: 'var(--ryu-text)' }}
          >
            {s.title}
          </h2>
          <p className="text-[12px]" style={{ color: 'var(--ryu-text-2)' }}>
            {s.genre ? `${s.genre} · ` : ''}{timeAgo(s.created_at)}
          </p>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-auto">

          {/* Chapters button — primary, takes most space */}
          <Link href={`/admin/chapters/new?series_id=${s.id}`} className="flex-1">
            <button
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{
                background: 'var(--ryu-primary-soft)',
                color: 'var(--ryu-primary-deep)',
                border: '1px solid var(--ryu-border)',
              }}
            >
              <BookMarked size={13} />
              Chapters
            </button>
          </Link>

          {/* Edit */}
          <Link href={`/admin/series/${s.id}`}>
            <button
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              title="Edit series"
              style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-2)' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--ryu-primary)'
                el.style.color = 'var(--ryu-primary-deep)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--ryu-border)'
                el.style.color = 'var(--ryu-text-2)'
              }}
            >
              <Pencil size={14} />
            </button>
          </Link>

          {/* Delete */}
          <AlertDialog>
            <AlertDialogTrigger
              disabled={deleting}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              title="Delete series"
              style={{ border: '1px solid var(--ryu-border-soft)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-3)' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = '#FECACA'
                el.style.background  = '#FEF2F2'
                el.style.color       = '#DC2626'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--ryu-border-soft)'
                el.style.background  = 'var(--ryu-surface-1)'
                el.style.color       = 'var(--ryu-text-3)'
              }}
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{s.title}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the series and all its chapters and pages. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(s.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </div>
    </div>
  )
}