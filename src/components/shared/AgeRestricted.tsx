'use client'

import Link from 'next/link'
import { useSavedAge } from '@/hooks/useSavedAge'
import { ALL_AGES } from '@/lib/age'

/** saved age >= min_age -> page, else block screen (spec 0003). before React: CSS picks via <html data-reader-age>. not access control */
export default function AgeRestricted({ minAge, children }: {
  minAge: number | null
  children: React.ReactNode
}) {
  const savedAge = useSavedAge()
  const required = minAge ?? ALL_AGES

  // undefined -> CSS decides; same tree -> no remount
  const blocked = savedAge == null || required <= ALL_AGES ? undefined : savedAge < required

  if (required <= ALL_AGES) return <>{children}</>

  return (
    <div className="age-restricted" data-min-age={required} style={{ display: 'contents' }}>
      <div className="age-restricted-content" style={{ display: blocked ? 'none' : 'contents' }}>
        {/* unmounted, not hidden (a hidden reader still saved progress) */}
        {blocked === true ? null : children}
      </div>
      {blocked !== false && <AgeBlockedScreen minAge={required} shown={blocked === true} />}
    </div>
  )
}

function AgeBlockedScreen({ minAge, shown }: { minAge: number; shown: boolean }) {
  return (
    <div
      className="age-restricted-block"
      style={{
        display: shown ? 'flex' : undefined,
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '32px 16px',
        background: 'var(--ryu-bg)',
        color: 'var(--ryu-text)',
        textAlign: 'center',
      }}
    >
      {/* h2: the page h1 stays its title */}
      <h2
        style={{
          fontFamily: 'var(--font-fredoka), sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(32px, 6vw, 56px)',
          letterSpacing: '0.02em',
          color: 'var(--ryu-primary)',
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        This comic is for {minAge}+ readers
      </h2>
      <p style={{ fontSize: 16, color: 'var(--ryu-text-2)', maxWidth: 400, margin: 0 }}>
        Based on the age you picked, this one isn&apos;t for you yet. There are
        plenty of other comics to read.
      </p>
      <Link
        href="/comics"
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
          textDecoration: 'none',
        }}
      >
        Back to comics
      </Link>
      {/* no "change age" here (one-tap bypass) */}
    </div>
  )
}
