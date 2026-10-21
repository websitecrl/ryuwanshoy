import type { Dir } from './views'

export type Point = { x: number; y: number }

export type FoldSetup = {
  sheetLeft: number
  spineX: number
  backLeft: number
  corner: Point
  start: Point
  complete: Point
}

export type FoldGeometry = {
  frontClip: string
  flapClip: string
  flapMatrix: string
  frontShade: string
  flapShade: string
}

const SHADOW = (percent: number) => `color-mix(in srgb, var(--ryu-shadow) ${percent}%, transparent)`
const LIGHT = (percent: number) => `color-mix(in srgb, var(--ryu-on-image) ${percent}%, transparent)`

export function foldSetup(dir: Dir, portrait: boolean, width: number, cornerY: number): FoldSetup {
  if (portrait) {
    const flat = { x: width, y: cornerY }
    const turned = { x: -width, y: cornerY }
    return {
      sheetLeft: 0,
      spineX: 0,
      backLeft: -width,
      corner: flat,
      start: dir === 'next' ? flat : turned,
      complete: dir === 'next' ? turned : flat,
    }
  }
  if (dir === 'next') {
    const corner = { x: width * 2, y: cornerY }
    return { sheetLeft: width, spineX: width, backLeft: 0, corner, start: corner, complete: { x: 0, y: cornerY } }
  }
  const corner = { x: 0, y: cornerY }
  return { sheetLeft: 0, spineX: width, backLeft: width, corner, start: corner, complete: { x: width * 2, y: cornerY } }
}

function clampToCircle(point: Point, center: Point, radius: number): Point {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const distance = Math.hypot(dx, dy)
  if (distance <= radius || distance === 0) return point
  return { x: center.x + (dx * radius) / distance, y: center.y + (dy * radius) / distance }
}

export function constrainPoint(point: Point, setup: FoldSetup, width: number, height: number): Point {
  const sameEdge = { x: setup.spineX, y: setup.corner.y }
  const otherEdge = { x: setup.spineX, y: height - setup.corner.y }
  const diagonal = Math.hypot(width, height)
  let p = clampToCircle(point, sameEdge, width)
  p = clampToCircle(p, otherEdge, diagonal)
  return clampToCircle(p, sameEdge, width)
}

export function foldProgress(setup: FoldSetup, point: Point): number {
  const tx = setup.complete.x - setup.start.x
  const ty = setup.complete.y - setup.start.y
  const total = tx * tx + ty * ty
  if (total === 0) return 0
  return ((point.x - setup.start.x) * tx + (point.y - setup.start.y) * ty) / total
}

function clipToHalfPlane(polygon: Point[], mid: Point, normal: Point, keepCornerSide: boolean): Point[] {
  const sign = keepCornerSide ? 1 : -1
  const side = (p: Point) => sign * ((p.x - mid.x) * normal.x + (p.y - mid.y) * normal.y)
  const out: Point[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!
    const b = polygon[(i + 1) % polygon.length]!
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

function polygonCss(points: Point[], toLocal: (p: Point) => Point): string {
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map(p => { const l = toLocal(p); return `${l.x.toFixed(2)}px ${l.y.toFixed(2)}px` }).join(', ')})`
}

function bandGradient(origin: Point, into: Point, width: number, height: number, stops: [number, string][]): string {
  const angle = Math.atan2(into.x, -into.y)
  const length = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))
  const start = (origin.x - width / 2) * into.x + (origin.y - height / 2) * into.y + length / 2
  const css = stops.map(([offset, color]) => `${color} ${(start + offset).toFixed(2)}px`).join(', ')
  return `linear-gradient(${((angle * 180) / Math.PI).toFixed(3)}deg, ${css})`
}

export function foldGeometry(setup: FoldSetup, point: Point, width: number, height: number): FoldGeometry | null {
  const nx = setup.corner.x - point.x
  const ny = setup.corner.y - point.y
  const length = Math.hypot(nx, ny)
  if (length < 0.5) return null

  const normal = { x: nx / length, y: ny / length }
  const mid = { x: (setup.corner.x + point.x) / 2, y: (setup.corner.y + point.y) / 2 }
  const dir = { x: -normal.y, y: normal.x }

  const sheet: Point[] = [
    { x: setup.sheetLeft, y: 0 },
    { x: setup.sheetLeft + width, y: 0 },
    { x: setup.sheetLeft + width, y: height },
    { x: setup.sheetLeft, y: height },
  ]
  const mirror = 2 * setup.spineX - setup.backLeft
  const toFront = (p: Point) => ({ x: p.x - setup.sheetLeft, y: p.y })
  const toBack = (p: Point) => ({ x: mirror - p.x, y: p.y })

  const front = clipToHalfPlane(sheet, mid, normal, false)
  const flap = clipToHalfPlane(sheet, mid, normal, true)

  const r11 = 2 * dir.x * dir.x - 1
  const r12 = 2 * dir.x * dir.y
  const r22 = 2 * dir.y * dir.y - 1
  const offsetX = mid.x - (r11 * mid.x + r12 * mid.y) + r11 * mirror
  const offsetY = mid.y - (r12 * mid.x + r22 * mid.y) + r12 * mirror
  const flapMatrix = `matrix(${-r11}, ${-r12}, ${r12}, ${r22}, ${offsetX}, ${offsetY})`

  const depth = Math.min(length / 2, width)
  const frontShade = bandGradient(toFront(mid), { x: -normal.x, y: -normal.y }, width, height, [
    [0, SHADOW(40)],
    [Math.max(8, depth * 0.25), SHADOW(0)],
  ])
  const flapShade = bandGradient(toBack(mid), { x: -normal.x, y: normal.y }, width, height, [
    [0, LIGHT(35)],
    [Math.max(6, depth * 0.12), LIGHT(0)],
    [Math.max(6, depth * 0.12), SHADOW(0)],
    [Math.max(12, depth), SHADOW(30)],
  ])

  return {
    frontClip: polygonCss(front, toFront),
    flapClip: polygonCss(flap, toBack),
    flapMatrix,
    frontShade,
    flapShade,
  }
}
