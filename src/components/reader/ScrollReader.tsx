'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import type { Tables } from '@/types/database'

type Page = Tables<'pages'>

type Props = {
  pages: Page[]
  totalPages: number
  uiVisible: boolean
  onToggleUI: () => void
  currentPage: number
  onPageChange: (page: number) => void
}

export default function ScrollReader({
  pages,
  totalPages,
  uiVisible,
  onToggleUI,
  currentPage,
  onPageChange,
}: Props) {
  const pageRefs    = useRef<(HTMLDivElement | null)[]>([])
  const didScrollRef = useRef(false)

  // mount -> scroll to currentPage (from flip mode)
useEffect(() => {
  if (currentPage <= 1) return
  if (didScrollRef.current) return

  let attempts = 0
  const MAX = 20 // 2s max

  const tryScroll = () => {
    const el = pageRefs.current[currentPage - 1]
    if (!el || el.getBoundingClientRect().height === 0) {
      // not rendered yet -> retry
      if (++attempts < MAX) setTimeout(tryScroll, 100)
      return
    }
    didScrollRef.current = true
    el.scrollIntoView({ behavior: 'instant' })
  }

  tryScroll()
}, [currentPage])

  // most visible page -> currentPage
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        const top = visible[0]
        if (top) {
          const idx = Number((top.target as HTMLElement).dataset.page)
          if (!isNaN(idx)) onPageChange(idx)
        }
      },
      { threshold: [0.3, 0.5, 0.7] }
    )

    const els = pageRefs.current
    els.forEach((el) => { if (el) observer.observe(el) })

    return () => observer.disconnect()
  }, [pages, onPageChange])

  const progress = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0

  return (
    <div className="relative">

      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
          uiVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pb-1">
          <span className="text-xs tabular-nums text-[var(--ryu-text-2)]">
            {currentPage} / {totalPages}
          </span>
        </div>
        <div className="h-1 bg-[var(--ryu-border)]">
          <div
            className="h-full transition-all duration-300 bg-[var(--ryu-primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center" onClick={onToggleUI}>
        {pages.map((page, index) => (
          <div
            key={page.id}
            data-page={index + 1}
            ref={(el) => { pageRefs.current[index] = el }}
            className="w-full"
            style={{ maxWidth: page.is_spread ? '1200px' : '800px' }}
          >
            <Image
              src={page.image_url}
              alt={`Page ${page.page_number}`}
              width={page.is_spread ? 800 : 800}
              height={page.is_spread ? 518 : 1035}
              sizes='(max-width: 800px) 100vw, 800px'
              className="w-full h-auto block"
              priority={index < 2}
              loading={index < 2 ? 'eager' : 'lazy'}
            />
          </div>
        ))}

        <div className="h-16" />
      </div>

    </div>
  )
}