import type { DisplayPage } from './book'

export type Dir = 'next' | 'prev'

export type Slot = DisplayPage | 'blank' | null

export type View = { start: number; slots: Slot[] }

export function isPage(slot: Slot): slot is DisplayPage {
  return slot !== null && slot !== 'blank'
}

export function buildViews(items: DisplayPage[], portrait: boolean): View[] {
  const views: View[] = []
  let start = 0
  while (start < items.length) {
    const first = items[start]!
    const second = items[start + 1] ?? null
    if (portrait) {
      views.push({ start, slots: [first] })
      start += 1
    } else if (second?.spreadSide === 'left') {
      views.push({ start, slots: [first, 'blank'] })
      start += 1
    } else {
      views.push({ start, slots: [first, second] })
      start += 2
    }
  }
  return views
}

export function viewAt(views: View[], position: number): number {
  let found = 0
  views.forEach((view, index) => {
    const first = view.slots.find(isPage)
    if (first && first.position <= position) found = index
  })
  return found
}

export function viewInfo(view: View, itemCount: number) {
  const shown = view.slots.filter(isPage)
  const end = view.start + shown.length - 1
  return {
    first: shown[0]?.position ?? 1,
    last: shown[shown.length - 1]?.position ?? 1,
    before: view.start,
    after: Math.max(0, itemCount - 1 - end),
  }
}

export type TurnLayout = {
  staticSlots: Slot[]
  front: Slot
  back: Slot
  side: 0 | 1
}

export function turnLayout(dir: Dir, portrait: boolean, from: View, to: View): TurnLayout {
  if (portrait) {
    return dir === 'next'
      ? { staticSlots: to.slots, front: from.slots[0] ?? null, back: null, side: 0 }
      : { staticSlots: from.slots, front: to.slots[0] ?? null, back: null, side: 0 }
  }
  return dir === 'next'
    ? {
        staticSlots: [from.slots[0] ?? null, to.slots[1] ?? null],
        front: from.slots[1] ?? null,
        back: to.slots[0] ?? null,
        side: 1,
      }
    : {
        staticSlots: [to.slots[0] ?? null, from.slots[1] ?? null],
        front: from.slots[0] ?? null,
        back: to.slots[1] ?? null,
        side: 0,
      }
}
