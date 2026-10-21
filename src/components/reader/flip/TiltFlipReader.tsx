'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  FLIP_MS,
  FlipProgress,
  NextArrow,
  PageContent,
  PageEdge,
  PrevArrow,
  buildDisplayPages,
  edgeWidth,
  useBookDims,
  type DisplayPage,
  type FlipReaderProps,
} from './book'

type View = { start: number; slots: (DisplayPage | null)[] }

type Turn = { dir: 'next' | 'prev'; to: number }

export function buildViews(items: DisplayPage[], portrait: boolean): View[] {
  const step = portrait ? 1 : 2
  const views: View[] = []
  for (let start = 0; start < items.length; start += step) {
    const first = items[start] ?? null
    views.push({
      start,
      slots: portrait ? [first] : [first, items[start + 1] ?? null],
    })
  }
  return views
}

export function viewInfo(view: View, itemCount: number) {
  const shown = view.slots.filter((slot): slot is DisplayPage => slot !== null)
  const end = view.start + shown.length - 1
  return {
    first: shown[0]?.position ?? 1,
    last: shown[shown.length - 1]?.position ?? 1,
    before: view.start,
    after: Math.max(0, itemCount - 1 - end),
  }
}

export function turnAngles(dir: Turn['dir'], portrait: boolean): [number, number] {
  if (portrait) return dir === 'next' ? [0, -90] : [-90, 0]
  return dir === 'next' ? [0, -180] : [0, 180]
}

const EASING = 'cubic-bezier(0.45, 0.05, 0.3, 1)'

const faceStyle = {
  position:                 'absolute',
  inset:                    0,
  overflow:                 'hidden',
  background:               '#111',
  backfaceVisibility:       'hidden',
  WebkitBackfaceVisibility: 'hidden',
} as const

const shadeStyle = {
  position:      'absolute',
  inset:         0,
  background:    'var(--ryu-shadow)',
  opacity:       0,
  pointerEvents: 'none',
} as const

export default function TiltFlipReader({
  pages,
  nextHref,
  uiVisible,
  onToggleUI,
  onPageChange,
}: FlipReaderProps) {
  const { isMobile, bookDims } = useBookDims()
  const { width: W, height: H } = bookDims

  const items = useMemo(() => buildDisplayPages(pages, isMobile), [pages, isMobile])
  const views = useMemo(() => buildViews(items, isMobile), [items, isMobile])

  const [viewIndex, setViewIndex] = useState(0)
  const [turn, setTurn] = useState<Turn | null>(null)

  const current = Math.min(viewIndex, Math.max(0, views.length - 1))
  const from = views[current]
  const to = turn ? views[turn.to] ?? null : null
  const turning = turn !== null && to !== null

  const leafRef = useRef<HTMLDivElement>(null)
  const frontShadeRef = useRef<HTMLDivElement>(null)
  const backShadeRef = useRef<HTMLDivElement>(null)
  const underShadeRef = useRef<HTMLDivElement>(null)

  const atStart = current <= 0
  const atEnd = current >= views.length - 1

  const goNext = useCallback(() => {
    if (turning || atEnd) return
    setTurn({ dir: 'next', to: current + 1 })
  }, [turning, atEnd, current])

  const goPrev = useCallback(() => {
    if (turning || atStart) return
    setTurn({ dir: 'prev', to: current - 1 })
  }, [turning, atStart, current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { goNext(); e.preventDefault() }
      if (e.key === 'ArrowLeft')                    { goPrev(); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  useLayoutEffect(() => {
    if (!turn) return
    const leaf = leafRef.current
    if (!leaf) return

    const [startAngle, endAngle] = turnAngles(turn.dir, isMobile)
    const timing = { duration: FLIP_MS, easing: EASING, fill: 'forwards' as const }
    const opening = isMobile && turn.dir === 'prev'
    const underFrames = opening ? [{ opacity: 0 }, { opacity: 0.35 }] : [{ opacity: 0.45 }, { opacity: 0 }]

    const leafAnimation = leaf.animate(
      [{ transform: `rotateY(${startAngle}deg)` }, { transform: `rotateY(${endAngle}deg)` }],
      timing,
    )
    const shadeAnimations = [
      frontShadeRef.current?.animate(
        [{ opacity: opening ? 0.5 : 0 }, { opacity: opening ? 0 : 0.5 }],
        timing,
      ),
      backShadeRef.current?.animate([{ opacity: 0.5 }, { opacity: 0 }], timing),
      underShadeRef.current?.animate(underFrames, timing),
    ]

    let cancelled = false
    leafAnimation.finished
      .then(() => {
        if (cancelled) return
        const target = views[turn.to]
        setViewIndex(turn.to)
        setTurn(null)
        if (target) onPageChange(viewInfo(target, items.length).last)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      leafAnimation.cancel()
      shadeAnimations.forEach(animation => animation?.cancel())
    }
  }, [turn, isMobile, views, items.length, onPageChange])

  useEffect(() => {
    const nearby = views.slice(Math.max(0, current - 2), current + 3)
    for (const view of nearby) {
      for (const slot of view.slots) {
        if (slot) new window.Image().src = slot.image_url
      }
    }
  }, [views, current])

  if (!from) return null

  const shownView = to ?? from
  const info = viewInfo(from, items.length)
  const edges = viewInfo(shownView, items.length)
  const edgeMax = isMobile ? 5 : 10
  const leftEdge = isMobile ? 0 : edgeWidth(edges.before, items.length, edgeMax)
  const rightEdge = edgeWidth(edges.after, items.length, edgeMax)

  const bookWidth = isMobile ? W : W * 2

  let staticSlots: (DisplayPage | null)[] = from.slots
  let leaf: {
    left: number
    origin: string
    angle: number
    front: DisplayPage | null
    back: DisplayPage | null
  } | null = null
  let underSide: 0 | 1 = 0

  if (turning && turn && to) {
    const angle = turnAngles(turn.dir, isMobile)[0]
    if (isMobile) {
      staticSlots = turn.dir === 'next' ? to.slots : from.slots
      leaf = {
        left: 0,
        origin: 'left center',
        angle,
        front: (turn.dir === 'next' ? from.slots[0] : to.slots[0]) ?? null,
        back: null,
      }
      underSide = 0
    } else if (turn.dir === 'next') {
      staticSlots = [from.slots[0] ?? null, to.slots[1] ?? null]
      leaf = { left: W, origin: 'left center', angle, front: from.slots[1] ?? null, back: to.slots[0] ?? null }
      underSide = 1
    } else {
      staticSlots = [to.slots[0] ?? null, from.slots[1] ?? null]
      leaf = { left: 0, origin: 'right center', angle, front: from.slots[0] ?? null, back: to.slots[1] ?? null }
      underSide = 0
    }
  }

  const spineFor = (index: number) => (isMobile ? null : index === 0 ? 'left' : 'right')

  function onBookClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    if (x < bookWidth / 2) goPrev()
    else goNext()
  }

  return (
    <div
      className="relative flex items-center justify-center select-none overflow-hidden bg-background"
      style={{ minHeight: 'calc(100vh - 48px)' }}
      onClick={onToggleUI}
    >
      <PrevArrow disabled={atStart} isMobile={isMobile} onPrev={goPrev} />

      <div
        data-flip-book
        onClick={onBookClick}
        style={{
          position:    'relative',
          width:       bookWidth,
          height:      H,
          perspective: isMobile ? 1200 : 1800,
          cursor:      'pointer',
        }}
      >
        <PageEdge side="left" width={leftEdge} />
        <PageEdge side="right" width={rightEdge} />

        {staticSlots.map((slot, index) => (
          <div
            key={index}
            style={{
              position:   'absolute',
              top:        0,
              left:       index * W,
              width:      W,
              height:     H,
              overflow:   'hidden',
              background: slot ? '#111' : 'transparent',
            }}
          >
            {slot && <PageContent page={slot} width={W} height={H} eager spine={spineFor(index)} />}
            {turning && index === underSide && <div ref={underShadeRef} style={shadeStyle} />}
          </div>
        ))}

        {leaf && (
          <div
            ref={leafRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            leaf.left,
              width:           W,
              height:          H,
              transformOrigin: leaf.origin,
              transform:       `rotateY(${leaf.angle}deg)`,
              transformStyle:  'preserve-3d',
              willChange:      'transform',
              zIndex:          2,
            }}
          >
            {leaf.front && (
              <div style={faceStyle}>
                <PageContent
                  page={leaf.front}
                  width={W}
                  height={H}
                  eager
                  spine={isMobile ? null : leaf.left === 0 ? 'left' : 'right'}
                />
                <div ref={frontShadeRef} style={shadeStyle} />
              </div>
            )}
            {leaf.back && (
              <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
                <PageContent
                  page={leaf.back}
                  width={W}
                  height={H}
                  eager
                  spine={leaf.left === 0 ? 'right' : 'left'}
                />
                <div ref={backShadeRef} style={shadeStyle} />
              </div>
            )}
          </div>
        )}
      </div>

      <NextArrow atEnd={atEnd} nextHref={nextHref} isMobile={isMobile} onNext={goNext} />

      <FlipProgress uiVisible={uiVisible} first={info.first} last={info.last} total={pages.length} />
    </div>
  )
}
