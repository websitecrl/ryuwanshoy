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
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="36" cy="36" r="32" stroke="var(--destructive)" strokeWidth="4.5" fill="var(--ryu-surface-1)"/>
            <text x="36" y="50" textAnchor="middle" fontSize="40" fontWeight="bold" fill="var(--destructive)" fontFamily="Bangers, cursive" letterSpacing="1">18</text>
            <line x1="10" y1="10" x2="62" y2="62" stroke="var(--destructive)" strokeWidth="5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Bangers', cursive",
          fontSize: 36, letterSpacing: '0.06em',
          color: 'var(--ryu-text)', margin: '0 0 10px',
        }}>
          HOW OLD ARE YOU?
        </h1>
        <p style={{
          fontSize: 14, color: 'var(--ryu-text-2)', lineHeight: 1.6,
          margin: '0 0 24px',
          fontFamily: "'Quicksand', sans-serif",
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
                fontFamily: "'Bangers', cursive",
                fontSize: 32, letterSpacing: '0.06em',
                color: 'var(--ryu-surface-1)', display: 'block', lineHeight: 1,
              }}>
                {tier.num}
              </span>
              <span style={{
                fontFamily: "'Bangers', cursive",
                fontSize: 13, letterSpacing: '0.08em',
                color: 'var(--ryu-surface-1)', display: 'block',
                marginBottom: 4, opacity: 0.9,
              }}>
                {tier.label}
              </span>
              <span style={{
                fontFamily: "'Quicksand', sans-serif",
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
            background: selected !== null ? 'var(--ryu-primary)' : 'var(--ryu-text-3)',
            boxShadow: selected !== null ? '4px 4px 0 var(--ryu-text)' : 'none',
            color: 'var(--ryu-surface-1)',
            fontFamily: "'Bangers', cursive",
            fontSize: 18, letterSpacing: '0.1em',
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
          fontFamily: "'Quicksand', sans-serif",
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 13 }}>☐</span>
          Self-reported · remembered on this device · asked only once
        </p>
      </div>
    </div>
  )
}