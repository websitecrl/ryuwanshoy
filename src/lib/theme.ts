export type Theme = 'light' | 'dark'

// shared theme key
export const THEME_KEY = 'ryu-theme'

// .dark on <html> = the only theme state
export function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function writeTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  try { localStorage.setItem(THEME_KEY, next) } catch {}
}

// <head> script: saved choice -> else OS preference -> class before paint
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`
