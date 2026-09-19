export type Theme = 'light' | 'dark'

// Same key the admin panel already used, now shared by the whole site.
export const THEME_KEY = 'ryu-theme'

// The `.dark` class on <html> is the single source of truth — every --ryu-*
// token in globals.css flips off it. Nothing else stores theme state.
export function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function writeTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  try { localStorage.setItem(THEME_KEY, next) } catch {}
}

// Inlined in <head> so the class is on <html> before first paint (no
// light-to-dark flash). Resolution order matches what admin did before:
// saved choice first, otherwise the OS preference.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`
