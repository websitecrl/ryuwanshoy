'use client'

import { useEffect } from 'react'
import CrashReport from '@/components/shared/CrashReport'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
// global-error REPLACES the root layout, so the layout's stylesheet (and the
// --ryu-* tokens in it) must be imported here, and it must render its own
// <html> and <body>.
import './globals.css'

/**
 * Last-resort error screen: shown when the root layout itself crashes
 * (error.tsx can't catch that, because it renders inside the layout).
 * Kept dependency-light on purpose: no navbar, no fonts, no toasts, no data.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    // Same theme bootstrap as the root layout, so dark-mode readers get the
    // dark tokens here too. suppressHydrationWarning: the script adds `dark`
    // to <html> before React hydrates (same reason as in layout.tsx).
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 32,
          background: 'var(--background)',
          color: 'var(--ryu-text)',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 700, color: 'var(--ryu-primary)', margin: 0 }}>
          Something broke!
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ryu-text-2)', maxWidth: 400, margin: 0 }}>
          The page couldn&apos;t load. Try again, and if it keeps happening, sending a report
          below helps get it fixed.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            border: '2px solid var(--ryu-primary)',
            background: 'var(--ryu-primary)',
            color: 'var(--ryu-on-primary)',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <CrashReport error={error} />
      </body>
    </html>
  )
}
