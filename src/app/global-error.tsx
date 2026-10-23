'use client'

import { useEffect } from 'react'
import CrashReport from '@/components/shared/CrashReport'
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-error'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
// replaces the root layout -> own styles, <html> and <body>
import './globals.css'

/** last-resort screen: no navbar, fonts, toasts or data */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const stale = isChunkLoadError(error)

  useEffect(() => {
    console.error(error)
    if (stale) reloadOnceForChunkError()
  }, [error, stale])

  return (
    // same theme bootstrap as layout.tsx
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
          {stale
            ? 'The site was just updated. Reload the page to get the new version.'
            : 'The page couldn’t load. Try again, and if it keeps happening, sending a report below helps get it fixed.'}
        </p>
        <button
          onClick={stale ? () => window.location.reload() : reset}
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
          {stale ? 'Reload' : 'Try again'}
        </button>
        <CrashReport error={error} />
      </body>
    </html>
  )
}
