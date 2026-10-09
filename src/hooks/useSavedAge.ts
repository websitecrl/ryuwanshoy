'use client'

import { useSyncExternalStore } from 'react'
import { AGE_CONFIRMED_ATTR, AGE_KEY, ALL_AGES, READER_AGE_ATTR } from '@/lib/age'

// Fallback when localStorage is blocked (private mode), so picking an age
// still closes the gate for this visit.
let memoryAge: number | null = null
const listeners = new Set<() => void>()

/** @returns the saved age band, or null when the reader hasn't picked one (or it is unreadable) */
function readSavedAge(): number | null {
  try {
    const stored = localStorage.getItem(AGE_KEY)
    if (stored !== null) {
      const age = Number(stored)
      return Number.isFinite(age) ? age : null
    }
  } catch {}
  return memoryAge
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Saves the reader's age band and tells every useSavedAge() reader. */
export function saveAge(age: number) {
  memoryAge = age
  try { localStorage.setItem(AGE_KEY, String(age)) } catch {}
  document.documentElement.setAttribute(AGE_CONFIRMED_ATTR, '')
  document.documentElement.setAttribute(READER_AGE_ATTR, String(age))
  listeners.forEach(listener => listener())
}

/** Forgets the saved age band, so the AgeGate asks again ("I picked the wrong age"). */
export function clearAge() {
  memoryAge = null
  try { localStorage.removeItem(AGE_KEY) } catch {}
  document.documentElement.removeAttribute(AGE_CONFIRMED_ATTR)
  document.documentElement.removeAttribute(READER_AGE_ATTR)
  listeners.forEach(listener => listener())
}

/**
 * The reader's saved age band.
 * @returns undefined while unknown (server HTML and the hydration render, so
 *   both match), null when no age is saved, otherwise the age band
 */
export function useSavedAge(): number | null | undefined {
  return useSyncExternalStore(subscribe, readSavedAge, () => undefined)
}

/**
 * For effects that SAVE reader state (progress, continue reading). Reads
 * storage directly instead of useSavedAge: on first load React mounts the
 * page once before it knows the age (to match the shared HTML), and effects
 * run in that moment, before AgeRestricted unmounts a blocked page.
 * @returns true when nothing is restricted or the saved age reaches minAge
 */
export function savedAgeAllows(minAge: number | null): boolean {
  const required = minAge ?? ALL_AGES
  if (required <= ALL_AGES) return true
  const age = readSavedAge()
  return age !== null && age >= required
}

/** Highest min_age a list may show: the saved age, or all ages until one is known. */
export function useMaxAge(): number {
  return useSavedAge() ?? ALL_AGES
}
