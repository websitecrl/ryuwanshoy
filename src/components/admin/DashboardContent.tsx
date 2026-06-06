'use client'

import Link from 'next/link'
import { BookOpen, BookMarked, Image, FileEdit, ExternalLink } from 'lucide-react'

type Series = {
  id: string
  title: string
  slug: string
  genre: string | null
  status: string | null
  cover_image: string | null
}

type Draft = {
  id: string
  title: string | null
  chapter_number: number
  series: { title: string; slug: string } | null
}

type Props = {
  series: Series[]
  drafts: Draft[]
}

export default function DashboardContent({ series, drafts }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6">

      {/* Current Series */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--ryu-surface-1)',
          border: '1px solid var(--ryu-border)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--ryu-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--ryu-primary-soft)', color: '#9A3412' }}
            >
              <BookOpen size={14} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--ryu-text)' }}>
              Series
            </span>
          </div>
          <Link
            href="/admin/series"
            className="text-xs font-semibold"
            style={{ color: 'var(--ryu-primary-deep)' }}
          >
            View all →
          </Link>
        </div>

        {series.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--ryu-text-3)' }}>
            No series yet — create your first one.
          </div>
        ) : (
          series.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-100"
              style={{
                borderBottom: i < series.length - 1 ? '1px solid var(--ryu-border-soft)' : 'none',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <div
                className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--ryu-surface-3)', border: '1px solid var(--ryu-border)' }}
              >
                {s.cover_image ? (
                  <img src={s.cover_image} alt={s.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen size={16} style={{ color: 'var(--ryu-text-3)' }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--ryu-text)' }}>
                  {s.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: 'var(--ryu-text-2)' }}>
                    {s.genre ?? '—'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={
                      s.status === 'ongoing'
                        ? { background: '#DCFCE7', color: '#15803D' }
                        : s.status === 'completed'
                        ? { background: 'var(--ryu-primary-soft)', color: '#9A3412' }
                        : { background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-2)' }
                    }
                  >
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{
                        background:
                          s.status === 'ongoing'   ? '#16A34A' :
                          s.status === 'completed' ? 'var(--ryu-primary)' :
                          'var(--ryu-text-3)',
                      }}
                    />
                    {s.status ?? '—'}
                  </span>
                </div>
              </div>

              <Link
                href={`/admin/series/${s.id}`}
                className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'var(--ryu-surface-2)',
                  border: '1px solid var(--ryu-border)',
                  color: 'var(--ryu-text-2)',
                }}
              >
                Edit
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Drafts */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--ryu-surface-1)',
          border: '1px solid var(--ryu-border)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--ryu-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
            >
              <FileEdit size={14} />
            </span>
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--ryu-text)' }}>
                Drafts
              </span>
              <span
                className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--ryu-primary-soft)', color: '#9A3412' }}
              >
                {drafts.length}
              </span>
            </div>
          </div>
          <Link
            href="/admin/drafts"
            className="text-xs font-semibold"
            style={{ color: 'var(--ryu-primary-deep)' }}
          >
            View all →
          </Link>
        </div>

        {drafts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--ryu-text-3)' }}>
            No drafts — all caught up!
          </div>
        ) : (
          drafts.map((draft, i) => (
            <div
              key={draft.id}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-100"
              style={{
                borderBottom: i < drafts.length - 1 ? '1px solid var(--ryu-border-soft)' : 'none',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-mono-ryu text-[8px] font-bold tracking-wider"
                style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
              >
                DRAFT
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--ryu-text)' }}>
                  {draft.series?.title ?? 'Unknown'} · Ch. {draft.chapter_number}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--ryu-text-2)' }}>
                  {draft.title ?? 'Untitled chapter'}
                </div>
              </div>

              <Link
                href={`/admin/chapters/${draft.id}`}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'var(--ryu-surface-2)',
                  border: '1px solid var(--ryu-border)',
                  color: 'var(--ryu-text-2)',
                }}
              >
                <FileEdit size={11} />
                Edit
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}