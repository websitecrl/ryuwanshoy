import Link from 'next/link'

export default function NotFound() {
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
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(80px, 15vw, 160px)',
          letterSpacing: '0.02em',
          color: 'var(--ryu-primary)',
          lineHeight: 1,
        }}
      >
        404
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(20px, 4vw, 32px)',
          letterSpacing: '0.02em',
          color: 'var(--ryu-text)',
        }}
      >
        This page doesn't exist!
      </p>
      <p style={{ fontSize: 15, color: 'var(--ryu-text-2)', maxWidth: 380 }}>
        The chapter, series, or page you're looking for may have been moved or deleted.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8,
          padding: '12px 28px',
          borderRadius: 8,
          border: '2px solid var(--ryu-primary)',
          background: 'var(--ryu-primary)',
          color: '#1E1E1E',
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          textDecoration: 'none',
        }}
      >
        Back to Home
      </Link>
    </div>
  )
}