import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Tables } from '@/types/database'

export type Page = Tables<'pages'>

export const FLIP_MS = 400

export type FlipReaderProps = {
  pages: Page[]
  seriesSlug: string
  prevHref: string | null
  nextHref: string | null
  uiVisible: boolean
  onToggleUI: () => void
  currentPage: number
  onPageChange: (page: number) => void
}

/** A flip book item. Spreads split into two items on desktop, so `position` is the page number readers see. */
export type DisplayPage = Page & { spreadSide: 'left' | 'right' | null; position: number }

// No cover or divider: an extra item before page 1 got readers stuck.
export function buildDisplayPages(pages: Page[], portrait: boolean): DisplayPage[] {
  return [...pages]
    .sort((a, b) => a.page_number - b.page_number)
    .flatMap((page, i): DisplayPage[] =>
      page.is_spread && !portrait
        ? [
            { ...page, spreadSide: 'left',  position: i + 1 },
            { ...page, spreadSide: 'right', position: i + 1 },
          ]
        : [{ ...page, spreadSide: null, position: i + 1 }]
    )
}

export function useBookDims() {
  const [isMobile, setIsMobile] = useState(false)
  const [bookDims, setBookDims] = useState({ width: 400, height: 560 })

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

  return { isMobile, bookDims }
}

export function edgeWidth(items: number, total: number, max: number) {
  if (items <= 0 || total <= 1) return 0
  return Math.max(2, Math.round((max * items) / (total - 1)))
}

export function PageEdge({ side, width }: { side: 'left' | 'right'; width: number }) {
  if (width === 0) return null
  return (
    <div
      aria-hidden
      style={{
        position:      'absolute',
        top:           3,
        bottom:        3,
        [side]:        -width,
        width,
        background:    `repeating-linear-gradient(to ${side}, var(--ryu-page-edge) 0 1px, var(--ryu-page-edge-line) 1px 2px)`,
        borderRadius:  side === 'left' ? '3px 0 0 3px' : '0 3px 3px 0',
        boxShadow:     '0 2px 4px color-mix(in srgb, var(--ryu-shadow) 35%, transparent)',
        transition:    `width ${FLIP_MS}ms ease, ${side} ${FLIP_MS}ms ease`,
        pointerEvents: 'none',
      }}
    />
  )
}

function spineShade(page: 'left' | 'right') {
  const dark = 'color-mix(in srgb, var(--ryu-shadow) 55%, transparent)'
  const soft = 'color-mix(in srgb, var(--ryu-shadow) 18%, transparent)'
  const fromSpine = page === 'left' ? 'to left' : 'to right'
  return `linear-gradient(${fromSpine}, ${dark}, ${soft} 4%, transparent 12%)`
}

export function PageContent({ page, width, height, eager, spine }: {
  page: DisplayPage
  width: number
  height: number
  eager: boolean
  spine: 'left' | 'right' | null
}) {
  return (
    <>
      {page.spreadSide ? (
        // Image at 2x page width, shifted one page left or right.
        <div
          style={{
            position: 'absolute',
            top:      0,
            left:     page.spreadSide === 'left' ? 0 : -width,
            width:    width * 2,
            height,
          }}
        >
          <Image
            src={page.image_url}
            alt={`Page ${page.page_number}`}
            fill
            className="object-cover"
            priority={eager}
            loading={eager ? 'eager' : 'lazy'}
          />
        </div>
      ) : (
        <Image
          src={page.image_url}
          alt={`Page ${page.page_number}`}
          fill
          className="object-contain"
          priority={eager}
          loading={eager ? 'eager' : 'lazy'}
        />
      )}
      {spine && (
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            background:    spineShade(spine),
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )
}

export function PrevArrow({ disabled, isMobile, onPrev }: {
  disabled: boolean
  isMobile: boolean
  onPrev: () => void
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onPrev() }}
      disabled={disabled}
      aria-label="Previous page"
      className="absolute left-2 z-10 p-2 md:p-3 transition-colors
                 disabled:opacity-20 disabled:cursor-not-allowed
                 text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
    >
      <ChevronLeft size={isMobile ? 22 : 28} />
    </button>
  )
}

export function NextArrow({ atEnd, nextHref, isMobile, onNext }: {
  atEnd: boolean
  nextHref: string | null
  isMobile: boolean
  onNext: () => void
}) {
  if (atEnd && nextHref) {
    return (
      <Link
        href={nextHref}
        onClick={e => e.stopPropagation()}
        className="absolute right-2 z-10 flex items-center gap-1 text-sm transition-colors
                   text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
      >
        Next <ChevronRight size={isMobile ? 22 : 28} />
      </Link>
    )
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onNext() }}
      disabled={atEnd}
      aria-label="Next page"
      className="absolute right-2 z-10 p-2 md:p-3 transition-colors
                 disabled:opacity-20 disabled:cursor-not-allowed
                 text-[var(--ryu-text-2)] hover:text-[var(--ryu-text)]"
    >
      <ChevronRight size={isMobile ? 22 : 28} />
    </button>
  )
}

export function FlipProgress({ uiVisible, first, last, total }: {
  uiVisible: boolean
  first: number
  last: number
  total: number
}) {
  const label = first === last
    ? `Page ${first} / ${total}`
    : `Page ${first} – ${last} / ${total}`
  const progress = total > 0 ? Math.round((last / total) * 100) : 0

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300
      ${uiVisible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex justify-center pb-1">
        <span className="text-xs tabular-nums text-[var(--ryu-text-2)]">
          {label}
        </span>
      </div>
      <div className="h-1 bg-[var(--ryu-border)]">
        <div
          className="h-full transition-all duration-300 bg-[var(--ryu-primary)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
