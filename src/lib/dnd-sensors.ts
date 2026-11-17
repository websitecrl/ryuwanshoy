'use client'

import type { CSSProperties } from 'react'
import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

/** how long a finger must rest on a page before it is picked up */
const TOUCH_PRESS_MS = 200
/** finger travel allowed during that press; more than this is a scroll, not a drag */
const TOUCH_TOLERANCE_PX = 8

/**
 * Sensors for the page-reorder grids: mouse + touch.
 *
 * Mouse: the drag starts once the pointer has moved `mouseDistance` px
 * (0 = straight away), which is how the grids behaved with PointerSensor.
 * Touch: press and hold about 200ms to pick a page up. A quick swipe never
 * starts a drag, so the page still scrolls, and once a drag has started the
 * Touch sensor stops the page from scrolling under the finger.
 *
 * Why not PointerSensor: it only works on touch screens with
 * `touch-action: none` on the draggable. Here the whole thumbnail is the
 * draggable, so that would make the grid impossible to scroll. dnd-kit's docs
 * recommend Mouse + Touch sensors for that case, with
 * `touch-action: manipulation` on the draggables (SORTABLE_TOUCH_STYLE below).
 *
 * @param mouseDistance - px the mouse must move before a drag starts
 * @returns sensors for <DndContext sensors={...}>
 */
export function usePageSortSensors(mouseDistance = 0) {
  return useSensors(
    useSensor(MouseSensor, mouseDistance > 0 ? { activationConstraint: { distance: mouseDistance } } : {}),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_PRESS_MS, tolerance: TOUCH_TOLERANCE_PX } }),
  )
}

/**
 * Goes on the element that carries the dnd-kit listeners.
 * manipulation: scrolling and pinch stay native, only double-tap zoom is off.
 * The rest stops the long press from opening the iOS image menu or selecting
 * text while the page is being held.
 */
export const SORTABLE_TOUCH_STYLE: CSSProperties = {
  touchAction: 'manipulation',
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
}
