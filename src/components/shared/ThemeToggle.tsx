'use client'

import { Moon, Sun } from 'lucide-react'
import { useRyuTheme } from '@/hooks/useRyuTheme'

type Props = {
  // pill: sun + moon side by side, current mode highlighted (navbar, admin)
  // icon: single glyph for tight toolbars (reader top bar)
  variant?: 'pill' | 'icon'
  className?: string
}

// Which glyph is highlighted/visible is driven by the `dark:` variant off the
// <html> class, not by React state, so it is correct on first paint with no
// icon flash. The hook is only needed for the accessible label.
export default function ThemeToggle({ variant = 'pill', className = '' }: Props) {
  const { theme, toggleTheme } = useRyuTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        className={className}
      >
        <Sun size={18} className="block dark:hidden" />
        <Moon size={18} className="hidden dark:block" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`flex items-center cursor-pointer ${className}`}
    >
      <span
        className="flex items-center rounded-full p-0.75"
        style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ryu-primary)] text-primary-foreground dark:bg-transparent dark:text-[var(--ryu-text-2)]">
          <Sun size={11} strokeWidth={2.2} />
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--ryu-text-2)] dark:bg-[var(--ryu-accent)] dark:text-[var(--ryu-on-accent)]">
          <Moon size={11} strokeWidth={2.2} />
        </span>
      </span>
    </button>
  )
}
