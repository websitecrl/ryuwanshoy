'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import HTMLFlipBook from 'react-pageflip'
import {
  FLIP_MS,
  PageContent,
  PageEdge,
  PrevArrow,
  NextArrow,
  FlipProgress,
  buildDisplayPages,
  edgeWidth,
  useBookDims,
  type DisplayPage,
  type FlipReaderProps,
} from './flip/book'

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
    before: start,
    after: Math.max(0, last - end),
  }
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
}: FlipReaderProps) {
  const bookRef    = useRef<FlipBookRef>(null)
  const didSyncRef = useRef(false)

  const { isMobile, bookDims } = useBookDims()

  const displayPages = useMemo(() => buildDisplayPages(pages, isMobile), [pages, isMobile])

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

  const edgeMax   = isMobile ? 5 : 10
  const leftEdge  = isMobile ? 0 : edgeWidth(view.before, displayPages.length, edgeMax)
  const rightEdge = edgeWidth(view.after, displayPages.length, edgeMax)

  // ── Reader ───────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex items-center justify-center select-none overflow-hidden bg-background"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      onClick={onToggleUI}
    >
      <PrevArrow disabled={view.atStart} isMobile={isMobile} onPrev={goPrev} />

      {/* Book */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        <PageEdge side="left" width={leftEdge} />
        <PageEdge side="right" width={rightEdge} />

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
          flippingTime={FLIP_MS}
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
          maxShadowOpacity={0.8}
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
              <PageContent
                page={page}
                width={bookDims.width}
                height={bookDims.height}
                eager={index < 4}
                spine={isMobile ? null : index % 2 === 0 ? 'left' : 'right'}
              />
            </div>
          ))}
        </HTMLFlipBook>
      </div>

      <NextArrow atEnd={view.atEnd} nextHref={nextHref} isMobile={isMobile} onNext={goNext} />

      <FlipProgress uiVisible={uiVisible} first={view.first} last={view.last} total={pages.length} />
    </div>
  )
}
