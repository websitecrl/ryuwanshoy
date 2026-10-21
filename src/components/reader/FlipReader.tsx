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
  type FlipReaderProps,
} from './flip/book'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { buildViews, isPage, turnLayout, viewAt, viewInfo, type Dir, type Slot, type TurnLayout } from './flip/views'
import { constrainPoint, foldGeometry, foldProgress, foldSetup, type FoldSetup, type Point } from './flip/fold'
import FoldLeaf from './flip/FoldLeaf'

type Turn = { dir: Dir; to: number }

type Fold = { dir: Dir; to: number; setup: FoldSetup; point: Point }

type Drag = {
  id: number
  startX: number
  startY: number
  lastX: number
  lastT: number
  velocity: number
  fold: Omit<Fold, 'point'> | null
}

const DRAG_START_PX = 8
const FLICK_PX_PER_MS = 0.35

export function turnAngles(dir: Dir, portrait: boolean): [number, number] {
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

export default function FlipReader({
  pages,
  nextHref,
  uiVisible,
  onToggleUI,
  currentPage,
  onPageChange,
}: FlipReaderProps) {
  const { isMobile, bookDims } = useBookDims()
  const { width: W, height: H } = bookDims
  const bookWidth = isMobile ? W : W * 2

  const items = useMemo(() => buildDisplayPages(pages, isMobile), [pages, isMobile])
  const views = useMemo(() => buildViews(items, isMobile), [items, isMobile])

  const reducedMotion = useReducedMotion()

  const [anchor, setAnchor] = useState(1)
  const [syncedPage, setSyncedPage] = useState(false)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [fold, setFold] = useState<Fold | null>(null)

  if (!syncedPage && currentPage > 1) {
    setSyncedPage(true)
    setAnchor(currentPage)
  }

  const current = viewAt(views, anchor)
  const from = views[current]
  const turnTo = turn ? views[turn.to] ?? null : null
  const foldTo = fold ? views[fold.to] ?? null : null
  const turning = turn !== null && turnTo !== null
  const folding = fold !== null && foldTo !== null
  const busy = turning || folding

  const leafRef = useRef<HTMLDivElement>(null)
  const frontShadeRef = useRef<HTMLDivElement>(null)
  const backShadeRef = useRef<HTMLDivElement>(null)
  const underShadeRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const pointRef = useRef<Point | null>(null)
  const settleRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  const atStart = current <= 0
  const atEnd = current >= views.length - 1

  const finishTurn = useCallback((to: number) => {
    const target = views[to]
    if (!target) return
    setAnchor(target.slots.find(isPage)?.position ?? 1)
    onPageChange(viewInfo(target, items.length).last)
  }, [views, items.length, onPageChange])

  const goNext = useCallback(() => {
    if (busy || atEnd) return
    if (reducedMotion) finishTurn(current + 1)
    else setTurn({ dir: 'next', to: current + 1 })
  }, [busy, atEnd, current, reducedMotion, finishTurn])

  const goPrev = useCallback(() => {
    if (busy || atStart) return
    if (reducedMotion) finishTurn(current - 1)
    else setTurn({ dir: 'prev', to: current - 1 })
  }, [busy, atStart, current, reducedMotion, finishTurn])

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
        setTurn(null)
        finishTurn(turn.to)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      leafAnimation.cancel()
      shadeAnimations.forEach(animation => animation?.cancel())
    }
  }, [turn, isMobile, finishTurn])

  useEffect(() => {
    const nearby = views.slice(Math.max(0, current - 2), current + 3)
    for (const view of nearby) {
      for (const slot of view.slots) {
        if (isPage(slot)) new window.Image().src = slot.image_url
      }
    }
  }, [views, current])

  useEffect(() => () => {
    if (settleRef.current !== null) cancelAnimationFrame(settleRef.current)
  }, [])

  function settle(active: Omit<Fold, 'point'>, completed: boolean) {
    const startPoint = pointRef.current ?? active.setup.start
    const target = completed ? active.setup.complete : active.setup.start
    const total = Math.hypot(active.setup.complete.x - active.setup.start.x, active.setup.complete.y - active.setup.start.y)
    const remaining = Math.hypot(target.x - startPoint.x, target.y - startPoint.y)
    const duration = Math.max(120, (FLIP_MS * remaining) / Math.max(1, total))
    const began = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const point = constrainPoint(
        { x: startPoint.x + (target.x - startPoint.x) * eased, y: startPoint.y + (target.y - startPoint.y) * eased },
        active.setup,
        W,
        H,
      )
      pointRef.current = point
      if (t < 1) {
        setFold({ ...active, point })
        settleRef.current = requestAnimationFrame(step)
        return
      }
      settleRef.current = null
      pointRef.current = null
      setFold(null)
      if (completed) finishTurn(active.to)
    }
    settleRef.current = requestAnimationFrame(step)
  }

  function localPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    suppressClickRef.current = false
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return
    const p = localPoint(e)
    dragRef.current = {
      id: e.pointerId,
      startX: p.x,
      startY: p.y,
      lastX: p.x,
      lastT: e.timeStamp,
      velocity: 0,
      fold: null,
    }
  }

  function startFold(drag: Drag, dx: number): Omit<Fold, 'point'> | null {
    const dir: Dir | null = isMobile
      ? (dx < 0 ? 'next' : 'prev')
      : drag.startX >= W
        ? (dx < 0 ? 'next' : null)
        : (dx > 0 ? 'prev' : null)
    if (!dir) return null
    if (dir === 'next' ? atEnd : atStart) return null
    const cornerY = drag.startY < H / 2 ? 0 : H
    return { dir, to: current + (dir === 'next' ? 1 : -1), setup: foldSetup(dir, isMobile, W, cornerY) }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const p = localPoint(e)
    const dx = p.x - drag.startX
    const dy = p.y - drag.startY

    const dt = e.timeStamp - drag.lastT
    if (dt > 0) drag.velocity = (p.x - drag.lastX) / dt
    drag.lastX = p.x
    drag.lastT = e.timeStamp

    if (!drag.fold) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      if (Math.abs(dx) < Math.abs(dy)) { dragRef.current = null; return }
      drag.fold = startFold(drag, dx)
      if (!drag.fold) { dragRef.current = null; return }
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    const factor = isMobile ? 2 : 1
    const { setup } = drag.fold
    const point = constrainPoint({ x: setup.start.x + dx * factor, y: setup.start.y + dy }, setup, W, H)
    pointRef.current = point
    setFold({ ...drag.fold, point })
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    if (!drag.fold) return
    suppressClickRef.current = true

    const { setup } = drag.fold
    const progress = foldProgress(setup, pointRef.current ?? setup.start)
    const towardComplete = Math.sign(setup.complete.x - setup.start.x) * drag.velocity
    const completed = !cancelled && (progress > 0.5 || (towardComplete > FLICK_PX_PER_MS && progress > 0.03))
    settle(drag.fold, completed)
  }

  function onBookClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    if (x < bookWidth / 2) goPrev()
    else goNext()
  }

  if (!from) return null

  const info = viewInfo(from, items.length)
  const edges = viewInfo(turnTo ?? foldTo ?? from, items.length)
  const edgeMax = isMobile ? 5 : 10
  const leftEdge = isMobile ? 0 : edgeWidth(edges.before, items.length, edgeMax)
  const rightEdge = edgeWidth(edges.after, items.length, edgeMax)

  let layout: TurnLayout | null = null
  if (turning && turn && turnTo) layout = turnLayout(turn.dir, isMobile, from, turnTo)
  if (folding && fold && foldTo) layout = turnLayout(fold.dir, isMobile, from, foldTo)

  const staticSlots: Slot[] = layout ? layout.staticSlots : from.slots
  const underSide = layout && turn ? (isMobile ? 0 : layout.side) : null
  const tiltAngle = turn ? turnAngles(turn.dir, isMobile)[0] : 0
  const frontSpine = isMobile || !layout ? null : layout.side === 0 ? 'left' : 'right'
  const backSpine = isMobile || !layout ? null : layout.side === 0 ? 'right' : 'left'
  const spineFor = (index: number) => (isMobile ? null : index === 0 ? 'left' : 'right')

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={e => onPointerEnd(e, false)}
        onPointerCancel={e => onPointerEnd(e, true)}
        onDragStart={e => e.preventDefault()}
        style={{
          position:    'relative',
          width:       bookWidth,
          height:      H,
          perspective: isMobile ? 1200 : 1800,
          cursor:      'pointer',
          touchAction: 'pan-y pinch-zoom',
        }}
      >
        <PageEdge side="left" width={leftEdge} />
        <PageEdge side="right" width={rightEdge} />

        {staticSlots.map((slot, index) => (
          <div
            key={reducedMotion ? `${from.start}-${index}` : index}
            className={reducedMotion ? 'animate-in fade-in duration-150' : undefined}
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
            {isPage(slot) && <PageContent page={slot} width={W} height={H} eager spine={spineFor(index)} />}
            {index === underSide && <div ref={underShadeRef} style={shadeStyle} />}
          </div>
        ))}

        {layout && turn && (
          <div
            ref={leafRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            layout.side * W,
              width:           W,
              height:          H,
              transformOrigin: layout.side === 1 || isMobile ? 'left center' : 'right center',
              transform:       `rotateY(${tiltAngle}deg)`,
              transformStyle:  'preserve-3d',
              willChange:      'transform',
              zIndex:          2,
            }}
          >
            {layout.front && (
              <div style={faceStyle}>
                {isPage(layout.front) && <PageContent page={layout.front} width={W} height={H} eager spine={frontSpine} />}
                <div ref={frontShadeRef} style={shadeStyle} />
              </div>
            )}
            {layout.back && (
              <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
                {isPage(layout.back) && <PageContent page={layout.back} width={W} height={H} eager spine={backSpine} />}
                <div ref={backShadeRef} style={shadeStyle} />
              </div>
            )}
          </div>
        )}

        {layout && fold && (
          <FoldLeaf
            geometry={foldGeometry(fold.setup, fold.point, W, H)}
            setup={fold.setup}
            front={layout.front}
            back={layout.back}
            width={W}
            height={H}
            frontSpine={frontSpine}
            backSpine={backSpine}
          />
        )}
      </div>

      <NextArrow atEnd={atEnd} nextHref={nextHref} isMobile={isMobile} onNext={goNext} />

      <FlipProgress uiVisible={uiVisible} first={info.first} last={info.last} total={pages.length} />
    </div>
  )
}
