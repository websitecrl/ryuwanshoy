'use client'

import { useSyncExternalStore } from 'react'
import { AGE_CONFIRMED_ATTR, AGE_KEY, ALL_AGES, READER_AGE_ATTR } from '@/lib/age'

// Fallback when localStorage is blocked, so picking an age still closes the gate.
let memoryAge: number | null = null
const listeners = new Set<() => void>()

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

/** undefined while unknown (server and hydration render), null when none is saved, else the age band. */
export function useSavedAge(): number | null | undefined {
  return useSyncExternalStore(subscribe, readSavedAge, () => undefined)
}

/** For effects that save reader state: reads storage directly, since a blocked page mounts once before the age is known. */
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
