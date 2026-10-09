'use client'

import { useEffect } from 'react'
import CrashReport from '@/components/shared/CrashReport'

/**
 * Error screen for anything that throws inside the root layout (pages,
 * loaders). The layout (navbar, footer, toasts) stays on screen.
 * Whole-page crashes are handled by global-error.tsx instead.
 */
export default function Error({
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '32px',
        background: 'var(--background)',
        color: 'var(--ryu-text)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(48px, 8vw, 96px)',
          letterSpacing: '0.02em',
          color: 'var(--ryu-primary)',
          lineHeight: 1,
        }}
      >
        Something broke!
      </h1>
      {/* Nothing is reported automatically, so don't claim the admin knows. */}
      <p style={{ fontSize: 16, color: 'var(--ryu-text-2)', maxWidth: 400 }}>
        An unexpected error occurred. Try again, and if it keeps happening, sending a report
        below helps get it fixed.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '12px 28px',
          borderRadius: 8,
          border: '2px solid var(--ryu-primary)',
          background: 'var(--ryu-primary)',
          color: 'var(--ryu-on-primary)',
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '0.02em',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
      <CrashReport error={error} />
    </div>
  )
}
