'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Heart } from 'lucide-react'

const navLinks = [
  { label: 'Home',       href: '/' },
  { label: 'Comics',     href: '/comics' },
  { label: 'Illustrations', href: '/posts' },
]

type NavbarProps = {
  siteTitle?: string | null
  logoUrl?: string | null
}

export default function Navbar({ siteTitle, logoUrl }: NavbarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: 'var(--ryu-surface-1)',
        borderBottom: '0.5px solid var(--ryu-border)',
        height: 64,
      }}
    >
      <div
        className="mx-auto flex h-full items-center justify-between px-5"
        style={{ maxWidth: 1600 }}
      >

    {/* Logo */}
    <Link href="/" className="font-comic shrink-0 flex items-center overflow-hidden group" style={{ letterSpacing: '0.06em' }}>
      {logoUrl ? (
        <>
          {/* Logo shifts left on hover */}
          <img
            src={logoUrl}
            alt={siteTitle ?? 'Logo'}
            style={{
              height: 60,
              width: 'auto',
              objectFit: 'contain',
              transition: 'transform 0.25s ease',
            }}
            className="group-hover:-translate-x-1"
          />
          {/* Title slides in from the right */}
          <span
            className="font-comic max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap"
            style={{
              fontSize: 30,
              background: 'linear-gradient(135deg, #F97316 0%, #FACC15 60%, #FEF08A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.06em',
              paddingLeft: 8,
            }}
          >
            {siteTitle ?? 'RYUWANSHOY'}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 34,
          background: 'linear-gradient(135deg, #F97316 0%, #FACC15 60%, #FEF08A 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(1px 2px 0px rgba(234,88,12,0.35))',
          letterSpacing: '0.06em',
        }}>
          {siteTitle ?? 'RYUWANSHOY'}
        </span>
      )}
    </Link>

        {/* Desktop links — bigger */}
        <nav className="hidden md:flex items-center gap-8 flex-1 ml-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-reader transition-colors"
              style={{
                fontSize: 15,       // ← was 13
                fontWeight: 600,
                color: pathname === link.href ? 'var(--ryu-text)' : 'var(--ryu-text-2)',
              }}
            >
              {link.label}
            </Link>
          ))}
      </nav>
          {/* Support CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/donate"
            className="font-comic flex items-center gap-1"
            style={{
              height: 30,
              padding: '0 14px',
              background: '#FEF08A',  // ← always yellow
              color: '#1E1E1E',       // ← black text
              border: '2.5px solid #1E1E1E',
              borderRadius: 8,
              fontSize: 13,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              boxShadow: '4px 4px 0 #1E1E1E',
              transition: 'transform .12s, box-shadow .12s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.transform = 'translate(2px,2px)'
              el.style.boxShadow = '2px 2px 0 #1E1E1E'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.transform = ''
              el.style.boxShadow = '4px 4px 0 #1E1E1E'
            }}
          >
            <Heart size={12} />
            Support
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden transition-colors"
          style={{ color: 'var(--ryu-text-2)' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{
            borderTop: '0.5px solid var(--ryu-border)',
            background: 'var(--ryu-surface-1)',
          }}
        >
          <nav className="flex flex-col px-5 py-3 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="font-reader py-2 transition-colors"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: pathname === link.href ? 'var(--ryu-text)' : 'var(--ryu-text-2)',
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/donate"
              onClick={() => setMenuOpen(false)}
              className="font-comic mt-2 flex items-center justify-center gap-2"
              style={{
                height: 36,
                background: '#4D2C7B',
                color: '#fff',
                border: '2.5px solid #1E1E1E',
                borderRadius: 8,
                fontSize: 13,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                boxShadow: '4px 4px 0 #1E1E1E',
              }}
            >
              <Heart size={13} />
              Support
            </Link>
          </nav>
        </div>
      )}
    </header>
  ) 
}