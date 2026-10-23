'use client'

import { useSyncExternalStore } from 'react'
import { readTheme, writeTheme, type Theme } from '@/lib/theme'

// watches the .dark class on <html> -> any toggle stays in sync
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// server -> light; head script fixes it before paint
const getServerSnapshot = (): Theme => 'light'

export function useRyuTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot)

  return {
    theme,
    setTheme: writeTheme,
    toggleTheme: () => writeTheme(readTheme() === 'dark' ? 'light' : 'dark'),
  }
}
