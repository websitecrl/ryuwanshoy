'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'ryu-age'

// Age tier colors mapped to CSS variables
const TIERS = [
  {
    value: 13,
    num: '13',
    label: '& BELOW',
    sub: 'All-ages & younger',
    bg: 'var(--ryu-success, #3B7A2E)',
  },
  {
    value: 16,
    num: '16–17',
    label: 'TEEN',
    sub: 'Mild themes okay',
    bg: 'var(--ryu-primary-deep)',
  },
  {
    value: 18,
    num: '18',
    label: '& ABOVE',
    sub: 'Mature unlocked',
    bg: 'var(--destructive)',
  },
]

export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [selected,  setSelected]  = useState<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setConfirmed(stored !== null)
  }, [])

  if (pathname.startsWith('/admin')) return <>{children}</>
  if (confirmed === null) return null
  if (confirmed) return <>{children}</>

  function confirm() {
    if (selected === null) return
    localStorage.setItem(STORAGE_KEY, String(selected))
    setConfirmed(true)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--ryu-surface-1)',
        borderRadius: 20,
        border: '3px solid var(--ryu-text)',
        boxShadow: '8px 8px 0 var(--ryu-text)',
        padding: '2.5rem 2rem 2rem',
        maxWidth: 480, width: '100%',
        textAlign: 'center',
      }}>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--destructive)',
            border: '3px solid var(--ryu-text)',
            boxShadow: '4px 4px 0 var(--ryu-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-fredoka), sans-serif',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '0.01em',
              color: 'var(--ryu-surface-1)',
            }}>
              18+
            </span>
          </div>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "var(--font-fredoka), sans-serif",
          fontWeight: 600,
          fontSize: 36, letterSpacing: '0.02em',
          color: 'var(--ryu-text)', margin: '0 0 10px',
        }}>
          HOW OLD ARE YOU?
        </h1>
        <p style={{
          fontSize: 14, color: 'var(--ryu-text-2)', lineHeight: 1.6,
          margin: '0 0 24px',
          fontFamily: "var(--font-fredoka), sans-serif",
        }}>
          We'll show you comics that fit your age. Pick the band<br />
          that's true for you — you'll only be asked once.
        </p>

        {/* Age buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {TIERS.map(tier => (
            <button
              key={tier.value}
              onClick={() => setSelected(tier.value)}
              style={{
                flex: 1, padding: '16px 8px',
                borderRadius: 12,
                border: `3px solid var(--ryu-text)`,
                background: tier.bg,
                boxShadow: selected === tier.value
                  ? '0 0 0 3px var(--ryu-surface-1), 0 0 0 6px var(--ryu-text)'
                  : '4px 4px 0 var(--ryu-text)',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.1s',
                transform: selected === tier.value ? 'translate(2px, 2px)' : 'none',
              }}
            >
              <span style={{
                fontFamily: "var(--font-fredoka), sans-serif",
                fontWeight: 600,
                fontSize: 32, letterSpacing: '0.01em',
                color: 'var(--ryu-surface-1)', display: 'block', lineHeight: 1,
              }}>
                {tier.num}
              </span>
              <span style={{
                fontFamily: "var(--font-fredoka), sans-serif",
                fontWeight: 600,
                fontSize: 13, letterSpacing: '0.04em',
                color: 'var(--ryu-surface-1)', display: 'block',
                marginBottom: 4, opacity: 0.9,
              }}>
                {tier.label}
              </span>
              <span style={{
                fontFamily: "var(--font-fredoka), sans-serif",
                fontSize: 11, color: 'var(--ryu-surface-1)',
                display: 'block', lineHeight: 1.4, opacity: 0.85,
              }}>
                {tier.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Enter button */}
        <button
          onClick={confirm}
          disabled={selected === null}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 10,
            border: '3px solid var(--ryu-text)',
            background: selected !== null
              ? TIERS.find(t => t.value === selected)?.bg ?? 'var(--ryu-primary)'
              : 'var(--ryu-text-3)',
            boxShadow: selected !== null ? '4px 4px 0 var(--ryu-text)' : 'none',
            color: 'var(--ryu-surface-1)',
            fontFamily: "var(--font-fredoka), sans-serif",
            fontWeight: 600,
            fontSize: 18, letterSpacing: '0.04em',
            cursor: selected === null ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, box-shadow 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          PICK YOUR AGE →
        </button>

        {/* Fine print */}
        <p style={{
          fontSize: 11, color: 'var(--ryu-text-3)', margin: '14px 0 0',
          fontFamily: "var(--font-fredoka), sans-serif",
        }}>
          Self-reported · remembered on this device · asked only once
        </p>
      </div>
    </div>
  )
}