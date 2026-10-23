'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useMaxAge } from '@/hooks/useSavedAge'
import { fitsAge } from '@/lib/age'

type ContinueReadingData = {
  seriesSlug: string
  seriesTitle: string
  chapterNumber: number
  chapterTitle: string | null
  coverImage: string | null
  currentPage?: number
}

export default function ContinueReading() {
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ContinueReadingData | null>(null)
  // min_age from the same /api/series check
  const [minAge, setMinAge] = useState<number | null>(null)
  const maxAge = useMaxAge()

  // stale entry -> drop it
  const forget = useCallback(() => {
    try { localStorage.removeItem('continueReading') } catch {}
    setData(null)
  }, [])

  useEffect(() => {
    setMounted(true)
    let entry: ContinueReadingData
    try {
      const raw = localStorage.getItem('continueReading')
      if (!raw) return
      entry = JSON.parse(raw) as ContinueReadingData
    } catch { return /* corrupted — ignore */ }

    // show only if series + chapter still live (404 -> forget; network error -> keep)
    let cancelled = false
    fetch(`/api/series/${encodeURIComponent(entry.seriesSlug)}`)
      .then(async res => {
        if (cancelled) return
        if (res.status === 404) { forget(); return }
        if (!res.ok) return
        const json = await res.json() as {
          data: { min_age?: number | null; chapters?: { chapter_number: number }[] } | null
        }
        if (cancelled) return
        const live = json.data?.chapters?.some(c => c.chapter_number === entry.chapterNumber)
        if (live) { setData(entry); setMinAge(json.data?.min_age ?? null) }
        else forget()
      })
      .catch(() => { /* offline — keep the entry, just don't show it */ })
    return () => { cancelled = true }
  }, [forget])

  if (!mounted || !data) return null
  // above saved age -> hidden, not forgotten
  if (!fitsAge(minAge, maxAge)) return null

  const href = `/comics/${data.seriesSlug}/${data.chapterNumber}${
    data.currentPage && data.currentPage > 1 ? `?page=${data.currentPage}` : ''
  }`
  return (
    <div
      className="flex items-center gap-4"
      style={{
        background: 'var(--ryu-surface-2)',
        border: '0.5px solid var(--ryu-border)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span style={{ color: 'var(--ryu-accent-deep)', fontSize: 15 }}>🔖</span>
        <div className="min-w-0">
          <p
            className="font-reader"
            style={{ fontSize: 10, color: 'var(--ryu-text-2)', marginBottom: 2 }}
          >
            Continue reading
          </p>
          <p
            className="font-comic truncate"
            style={{ fontSize: 14, letterSpacing: '0.04em', color: 'var(--ryu-text)' }}
          >
            {data.seriesTitle} · Ch. {data.chapterNumber}
            {data.chapterTitle ? ` — ${data.chapterTitle}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={href}
          className="font-comic inline-flex items-center gap-1"
          style={{
            height: 34, padding: '0 14px',
            background: 'var(--ryu-accent)', color: 'var(--ryu-on-accent)',
            border: '2.5px solid var(--ryu-ink)', borderRadius: 8,
            fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase',
            boxShadow: '4px 4px 0 var(--ryu-ink)',
          }}
        >
          Continue →
        </Link>
        <button
          onClick={() => { localStorage.removeItem('continueReading'); setData(null) }}
          aria-label="Dismiss"
          style={{ color: 'var(--ryu-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}