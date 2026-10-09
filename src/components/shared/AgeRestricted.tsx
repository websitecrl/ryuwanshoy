'use client'

import Link from 'next/link'
import { clearAge, useSavedAge } from '@/hooks/useSavedAge'
import { ALL_AGES } from '@/lib/age'

/**
 * Shows the page only to readers whose saved age band reaches the series
 * min_age; everyone else gets a "not for your age" screen. Spec 0003.
 *
 * The HTML is the same for every visitor and holds both the page and the
 * block screen. Before React loads, CSS picks one off <html data-reader-age>
 * (set by AGE_INIT_SCRIPT, see globals.css), so a younger reader never sees
 * a flash of the page. After, useSavedAge decides.
 *
 * The age is self reported: this protects honest younger readers, it is not
 * access control.
 *
 * @param minAge - the series min_age; null or 13 renders the page as is
 */
export default function AgeRestricted({ minAge, children }: {
  minAge: number | null
  children: React.ReactNode
}) {
  const savedAge = useSavedAge()
  const required = minAge ?? ALL_AGES

  // undefined: not known yet (server HTML, hydration) or no age saved (the
  // AgeGate covers the page), so CSS decides. Same element tree in every
  // case, so the page isn't remounted once the age is read.
  const blocked = savedAge == null || required <= ALL_AGES ? undefined : savedAge < required

  if (required <= ALL_AGES) return <>{children}</>

  return (
    <div className="age-restricted" data-min-age={required} style={{ display: 'contents' }}>
      <div className="age-restricted-content" style={{ display: blocked ? 'none' : 'contents' }}>
        {children}
      </div>
      {blocked !== false && <AgeBlockedScreen minAge={required} shown={blocked === true} />}
    </div>
  )
}

function AgeBlockedScreen({ minAge, shown }: { minAge: number; shown: boolean }) {
  return (
    <div
      className="age-restricted-block"
      // When React knows the reader is too young, show it outright; otherwise
      // the CSS rules in globals.css decide (hidden by default).
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
      {/* h2, not h1: this is in the shared HTML of every restricted page, and
          the page's own h1 is what search engines should read as its title. */}
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
      <button
        type="button"
        onClick={clearAge}
        style={{
          background: 'none',
          border: 'none',
          padding: 8,
          color: 'var(--ryu-text-2)',
          fontSize: 14,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        I picked the wrong age
      </button>
    </div>
  )
}
