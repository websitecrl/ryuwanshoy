'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

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

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem('continueReading')
      if (!raw) return
      setData(JSON.parse(raw) as ContinueReadingData)
    } catch { /* corrupted — ignore */ }
  }, [])

  if (!mounted || !data) return null

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
      {/* Bookmark label */}
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

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={href}
          className="font-comic inline-flex items-center gap-1"
          style={{
            height: 34, padding: '0 14px',
            background: 'var(--ryu-accent)', color: 'var(--ryu-text)',
            border: '2.5px solid #1E1E1E', borderRadius: 8,
            fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase',
            boxShadow: '4px 4px 0 #1E1E1E',
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