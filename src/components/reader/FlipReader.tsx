'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HTMLFlipBook from 'react-pageflip'
import type { Tables } from '@/types/database'
import { type ReaderTheme } from './ReaderTopBar'

type Page = Tables<'pages'>

type Props = {
  pages: Page[]
  seriesSlug: string
  seriesTitle: string
  coverImage: string | null
  chapterNumber: number
  prevHref: string | null
  nextHref: string | null
  uiVisible: boolean
  onToggleUI: () => void
  currentPage: number
  onPageChange: (page: number) => void
  theme: ReaderTheme
}

type FlipBookRef = {
  pageFlip: () => {
    flipNext: (corner?: string) => void
    flipPrev: (corner?: string) => void
    getCurrentPageIndex: () => number
    getPageCount: () => number
    turnToPage: (page: number) => void
  }
}

export default function FlipReader({
  pages,
  seriesSlug,
  seriesTitle,
  coverImage,
  chapterNumber,
  prevHref,
  nextHref,
  uiVisible,
  onToggleUI,
  currentPage,
  onPageChange,
  theme,
}: Props) {
  const bookRef    = useRef<FlipBookRef>(null)
  const didSyncRef = useRef(false)

  const [totalPages, setTotalPages] = useState(0)
  const [isMobile,   setIsMobile]   = useState(false)
  const [bookDims,   setBookDims]   = useState({ width: 400, height: 560 })

  // ── Responsive dims ──────────────────────────────────────────────────────
  useEffect(() => {
    function update() {
      const mobile = window.innerWidth <= 880
      setIsMobile(mobile)
      if (mobile) {
        const w = Math.min(Math.round(window.innerWidth * 0.88), 480)
        const h = Math.round(w * (3300 / 2550))
        setBookDims({ width: w, height: h })
      } else {
        const h = Math.min(Math.round(window.innerHeight * 0.82), 860)
        const w = Math.round(h * (2550 / 3300))
        setBookDims({ width: w, height: h })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Book init — jump to synced page if resuming ──────────────────────────
  function onInit(e: { object: { getPageCount: () => number } }) {
    setTotalPages(e.object.getPageCount())
    if (!didSyncRef.current && currentPage > 1) {
      didSyncRef.current = true
      setTimeout(() => {
        bookRef.current?.pageFlip().turnToPage(currentPage)
      }, 100)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  const goNext = useCallback(() => { bookRef.current?.pageFlip().flipNext() }, [])
  const goPrev = useCallback(() => { bookRef.current?.pageFlip().flipPrev() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { goNext(); e.preventDefault() }
      if (e.key === 'ArrowLeft')                    { goPrev(); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  function onFlip(e: { data: number }) {
    onPageChange(Math.max(1, e.data))
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const atStart  = currentPage <= 1
  const atEnd    = totalPages > 0 && currentPage >= totalPages - (isMobile ? 1 : 2)
  const progress = totalPages > 0 ? Math.round((currentPage / (totalPages - 1)) * 100) : 0

  const comicPage = Math.max(1, currentPage)
  const pageLabel = isMobile
    ? `Page ${Math.min(comicPage, pages.length)} / ${pages.length}`
    : `Page ${Math.min(comicPage, pages.length)} – ${Math.min(comicPage + 1, pages.length)} / ${pages.length}`

  const bg = theme === 'light' ? 'bg-[#FFFBF5]' : 'bg-[#0a0a0a]'

  // ── Reader ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative flex items-center justify-center select-none overflow-hidden ${bg}`}
      style={{ minHeight: 'calc(100vh - 48px)' }}
      onClick={onToggleUI}
    >
      {/* Prev arrow */}
      <button
        onClick={e => { e.stopPropagation(); goPrev() }}
        disabled={atStart}
        aria-label="Previous page"
        className={`absolute left-2 z-10 p-2 md:p-3 transition-colors
                   disabled:opacity-20 disabled:cursor-not-allowed ${
                     theme === 'light'
                       ? 'text-[var(--ryu-text-3)] hover:text-[var(--ryu-text)]'
                       : 'text-neutral-600 hover:text-white'
                   }`}
      >
        <ChevronLeft size={isMobile ? 22 : 28} />
      </button>

      {/* Book + center spine line */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        {/* Center spine line — desktop spread only, subtle divider between pages */}
        {!isMobile && (
          <div
            style={{
              position:      'absolute',
              left:          '50%',
              top:           0,
              bottom:        0,
              width:         '2px',
              transform:     'translateX(-50%)',
              background:    theme === 'light'
                ? 'rgba(0,0,0,0.10)'
                : 'rgba(255,255,255,0.07)',
              zIndex:        10,
              pointerEvents: 'none',
            }}
          />
        )}

        <HTMLFlipBook
          ref={bookRef}
          width={bookDims.width}
          height={bookDims.height}
          size="fixed"
          minWidth={bookDims.width}
          maxWidth={bookDims.width}
          minHeight={bookDims.height}
          maxHeight={bookDims.height}
          drawShadow
          flippingTime={600}
          usePortrait={isMobile}
          startPage={1}
          showCover
          mobileScrollSupport={false}
          onFlip={onFlip}
          onInit={onInit}
          style={{}}
          className=""
          startZIndex={0}
          autoSize={false}
          clickEventForward
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={false}
          maxShadowOpacity={0.5}
        >
          {/* Index 0 — cover (user can flip back to it) */}
          <div
            style={{
              width:      bookDims.width,
              height:     bookDims.height,
              position:   'relative',
              overflow:   'hidden',
              background: '#111',
            }}
          >
            {coverImage ? (
              <Image
                src={coverImage}
                alt={`${seriesTitle} cover`}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-end justify-end p-6"
                style={{ background: 'linear-gradient(135deg, #1C1917, #44170A)' }}
              >
                <p
                  className="text-white text-3xl text-right leading-tight"
                  style={{ fontFamily: 'var(--font-bangers), cursive', letterSpacing: '0.06em' }}
                >
                  {seriesTitle}
                </p>
                <p className="text-white/60 text-sm mt-1">Chapter {chapterNumber}</p>
              </div>
            )}
            <div
              className="absolute left-0 top-0 bottom-0 pointer-events-none"
              style={{
                width:      32,
                background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)',
              }}
            />
          </div>

          {/* Index 1+ — comic pages */}
          {pages.map((page, index) => (
            <div
              key={page.id}
              style={{
                width:      bookDims.width,
                height:     bookDims.height,
                background: '#111',
                position:   'relative',
                overflow:   'hidden',
              }}
            >
              <Image
                src={page.image_url}
                alt={`Page ${page.page_number}`}
                fill
                className="object-contain"
                priority={index < 4}
                loading={index < 4 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </HTMLFlipBook>
      </div>

      {/* Next arrow / next chapter */}
      {atEnd && nextHref ? (
        <Link
          href={nextHref}
          onClick={e => e.stopPropagation()}
          className={`absolute right-2 z-10 flex items-center gap-1 text-sm transition-colors ${
            theme === 'light'
              ? 'text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Next <ChevronRight size={isMobile ? 22 : 28} />
        </Link>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); goNext() }}
          disabled={atEnd}
          aria-label="Next page"
          className={`absolute right-2 z-10 p-2 md:p-3 transition-colors
                     disabled:opacity-20 disabled:cursor-not-allowed ${
                       theme === 'light'
                         ? 'text-[var(--ryu-text-3)] hover:text-[var(--ryu-text)]'
                         : 'text-neutral-600 hover:text-white'
                     }`}
        >
          <ChevronRight size={isMobile ? 22 : 28} />
        </button>
      )}

      {/* Progress bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300
        ${uiVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center pb-1">
          <span className={`text-xs tabular-nums ${
            theme === 'light' ? 'text-[var(--ryu-text-3)]' : 'text-neutral-500'
          }`}>
            {pageLabel}
          </span>
        </div>
        <div className={`h-1 ${theme === 'light' ? 'bg-[var(--ryu-border)]' : 'bg-neutral-800'}`}>
          <div
            className={`h-full transition-all duration-300 ${
              theme === 'light' ? 'bg-[var(--ryu-primary)]' : 'bg-white'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}