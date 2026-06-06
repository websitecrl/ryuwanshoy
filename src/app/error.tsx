'use client'

import { useEffect } from 'react'

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
        background: 'var(--ryu-bg)',
        color: 'var(--ryu-text)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-bangers)',
          fontSize: 'clamp(48px, 8vw, 96px)',
          letterSpacing: '0.05em',
          color: 'var(--ryu-primary)',
          lineHeight: 1,
        }}
      >
        Something broke!
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ryu-text-2)', maxWidth: 400 }}>
        An unexpected error occurred. Try refreshing the page — if it keeps happening, the admin has been notified.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '12px 28px',
          borderRadius: 8,
          border: '2px solid var(--ryu-primary)',
          background: 'var(--ryu-primary)',
          color: '#1E1E1E',
          fontFamily: 'var(--font-bangers)',
          fontSize: 20,
          letterSpacing: '0.05em',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}