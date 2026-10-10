'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HTMLFlipBook from 'react-pageflip'
import type { Tables } from '@/types/database'

type Page = Tables<'pages'>

/**
 * One item in the flip book. A two page spread is split into two items on
 * desktop, so book indexes and chapter pages don't line up 1:1; `position`
 * (1 based place in the chapter) is the page number readers see.
 */
type DisplayPage = Page & { spreadSide: 'left' | 'right' | null; position: number }

/**
 * The chapter pages visible at a flip book index.
 * @param index - the book index from onFlip (e.data)
 * @param portrait - one item at a time (mobile); otherwise a two item spread,
 *   paired [0,1], [2,3]... since there is no cover page
 * @returns first and last visible chapter position, and whether the book is
 *   at its first or last item
 */
function visibleRange(displayPages: DisplayPage[], index: number, portrait: boolean) {
  const last = displayPages.length - 1
  const start = Math.min(Math.max(0, portrait ? index : index - (index % 2)), Math.max(0, last))
  const end = portrait ? start : Math.min(start + 1, last)
  return {
    first: displayPages[start]?.position ?? 1,
    last: displayPages[end]?.position ?? 1,
    atStart: start <= 0,
    atEnd: end >= last,
  }
}

type Props = {
  pages: Page[]
  seriesSlug: string
  prevHref: string | null
  nextHref: string | null
  uiVisible: boolean
  onToggleUI: () => void
  currentPage: number
  onPageChange: (page: number) => void
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
  nextHref,
  uiVisible,
  onToggleUI,
  currentPage,
  onPageChange,
}: Props) {
  const bookRef    = useRef<FlipBookRef>(null)
  const didSyncRef = useRef(false)

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

  // Only this chapter's pages, in page_number order. No cover or divider: an
  // extra item before page 1 is what readers could flip back to and get
  // stuck on, with the counter still saying page 1.
  const displayPages: DisplayPage[] = useMemo(() =>
    [...pages]
      .sort((a, b) => a.page_number - b.page_number)
      .flatMap((page, i): DisplayPage[] =>
        page.is_spread && !isMobile
          ? [
              { ...page, spreadSide: 'left',  position: i + 1 },
              { ...page, spreadSide: 'right', position: i + 1 },
            ]
          : [{ ...page, spreadSide: null, position: i + 1 }]
      ),
  [pages, isMobile])

  // The flip book index on screen. Set only from the book itself (onFlip, or
  // the resume jump), so the counter, progress bar and arrows can't drift.
  const [bookIndex, setBookIndex] = useState(0)
  const view = visibleRange(displayPages, bookIndex, isMobile)

  // ── Book init — jump to synced page if resuming ──────────────────────────
  function onInit() {
    if (!didSyncRef.current && currentPage > 1) {
      didSyncRef.current = true

      let attempts = 0
      const MAX = 20
      
      const tryFlip = () => {
        const api = bookRef.current?.pageFlip()
        if (!api) {
          if (++attempts < MAX) setTimeout(tryFlip, 100)
          return
        }
        const count = api.getPageCount()
        if (count === 0) {
          if (++attempts < MAX) setTimeout(tryFlip, 100)
          return
        }
        const target = Math.max(0, displayPages.findIndex(p => p.position === currentPage))
        api.turnToPage(target)
        setBookIndex(api.getCurrentPageIndex())
      }
      setTimeout(tryFlip, 100)
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

  // e.data is the book index. Report the LAST visible page, so reaching the
  // final spread on desktop counts as reading the last page.
  function onFlip(e: { data: number }) {
    setBookIndex(e.data)
    onPageChange(visibleRange(displayPages, e.data, isMobile).last)
  }

  // ── Derived state (all from bookIndex) ───────────────────────────────────
  const { atStart, atEnd } = view
  const total = pages.length
  const pageLabel = view.first === view.last
    ? `Page ${view.first} / ${total}`
    : `Page ${view.first} – ${view.last} / ${total}`
  const progress = total > 0 ? Math.round((view.last / total) * 100) : 0

  // ── Reader ───────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex items-center justify-center select-none overflow-hidden bg-background"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      onClick={onToggleUI}
    >
      {/* Prev arrow */}
      <button
        onClick={e => { e.stopPropagation(); goPrev() }}
        disabled={atStart}
        aria-label="Previous page"
        className="absolute left-2 z-10 p-2 md:p-3 transition-colors
                   disabled:opacity-20 disabled:cursor-not-allowed
                   text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
      >
        <ChevronLeft size={isMobile ? 22 : 28} />
      </button>

      {/* Book + center spine line */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        {/* Center spine line — desktop spread only, subtle divider between pages.
            --ryu-text is near-black in light and cream in dark, so a low opacity
            gives the same soft crease in both without a theme branch. */}
        {!isMobile && (
          <div
            style={{
              position:      'absolute',
              left:          '50%',
              top:           0,
              bottom:        0,
              width:         '2px',
              transform:     'translateX(-50%)',
              background:    'var(--ryu-text)',
              opacity:       0.1,
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
          startPage={0}
          showCover={false}
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
          {/* Comic pages only; index 0 is page 1 */}
          {displayPages.map((page, index) => (
            <div
              key={`${page.id}-${page.spreadSide ?? 'single'}`}
              style={{
                width:      bookDims.width,
                height:     bookDims.height,
                background: '#111',
                position:   'relative',
                overflow:   'hidden',
              }}
            >
              {page.spreadSide ? (
                // Force a deterministic split: render the image at 2x page width,
                // then shift it exactly one page-width left or right.
                <div
                  style={{
                    position: 'absolute',
                    top:      0,
                    left:     page.spreadSide === 'left' ? 0 : -bookDims.width,
                    width:    bookDims.width * 2,
                    height:   bookDims.height,
                  }}
                >
                  <Image
                    src={page.image_url}
                    alt={`Page ${page.page_number}`}
                    fill
                    className="object-cover"
                    priority={index < 4}
                    loading={index < 4 ? 'eager' : 'lazy'}
                  />
                </div>
              ) : (
                <Image
                  src={page.image_url}
                  alt={`Page ${page.page_number}`}
                  fill
                  className="object-contain"
                  priority={index < 4}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
              )}
            </div>
          ))}
        </HTMLFlipBook>
      </div>

      {/* Next arrow / next chapter */}
      {atEnd && nextHref ? (
        <Link
          href={nextHref}
          onClick={e => e.stopPropagation()}
          className="absolute right-2 z-10 flex items-center gap-1 text-sm transition-colors
                     text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
        >
          Next <ChevronRight size={isMobile ? 22 : 28} />
        </Link>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); goNext() }}
          disabled={atEnd}
          aria-label="Next page"
          className="absolute right-2 z-10 p-2 md:p-3 transition-colors
                     disabled:opacity-20 disabled:cursor-not-allowed
                     text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
        >
          <ChevronRight size={isMobile ? 22 : 28} />
        </button>
      )}

      {/* Progress bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300
        ${uiVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center pb-1">
          <span className="text-xs tabular-nums text-[var(--ryu-text-2)]">
            {pageLabel}
          </span>
        </div>
        <div className="h-1 bg-[var(--ryu-border)]">
          <div
            className="h-full transition-all duration-300 bg-[var(--ryu-primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}