import type { DisplayPage } from './book'

export type Dir = 'next' | 'prev'

export type Slot = DisplayPage | null

export type View = { start: number; slots: Slot[] }

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
