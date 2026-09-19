'use client'

import { useSyncExternalStore } from 'react'
import { readTheme, writeTheme, type Theme } from '@/lib/theme'

// Subscribes to the `.dark` class on <html> rather than keeping its own copy,
// so anything that flips the class (a toggle, another tab's script, the
// pre-paint init) stays in sync without extra wiring.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// Server has no <html> class to read; the head script fixes it before paint
// and React re-renders with the real value right after hydration.
const getServerSnapshot = (): Theme => 'light'

export function useRyuTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot)

  return {
    theme,
    setTheme: writeTheme,
    toggleTheme: () => writeTheme(readTheme() === 'dark' ? 'light' : 'dark'),
  }
}
