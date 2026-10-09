'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SocialLinks from './SocialLinks'

type FooterProps = {
  facebookUrl?: string | null
  instagramUrl?: string | null
  twitterUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

const footerLinks = [
  { label: 'Home',          href: '/' },
  { label: 'Comics',        href: '/comics' },
  { label: 'Illustrations', href: '/posts' },
  { label: 'Support',       href: '/donate' },
]

export default function Footer({
  facebookUrl,
  instagramUrl,
  twitterUrl,
  youtubeUrl,
  tiktokUrl,
}: FooterProps) {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()
  // Tell the feedback form which page the reader was on (not when already there).
  const feedbackHref = pathname && pathname !== '/feedback'
    ? `/feedback?from=${encodeURIComponent(pathname)}`
    : '/feedback'

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '0.5px solid var(--ryu-border)',
        background: 'var(--ryu-surface-1)',
      }}
    >
      {/* minHeight, not height, + flex-wrap: on narrow phones the row wraps
          instead of overflowing. Desktop stays one 80px row. */}
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-8 py-4"
        style={{ maxWidth: 1600, minHeight: 80 }}
      >
        {/* Left — copyright + social icons */}
        <div className="flex items-center gap-5">
          <p
            className="font-reader"
            style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}
          >
            © {currentYear} Ryuwanshoy · all comics by Ryu
          </p>

          <SocialLinks
            facebookUrl={facebookUrl}
            instagramUrl={instagramUrl}
            twitterUrl={twitterUrl}
            tiktokUrl={tiktokUrl}
            youtubeUrl={youtubeUrl}
          />
        </div>

        {/* Right — nav links (hidden on mobile) + Feedback (always shown) */}
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-reader transition-colors"
                style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ryu-text-3)')}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href={feedbackHref}
            prefetch={false} // static page; avoid prefetching a separate ?from= URL per page
            className="font-reader transition-colors"
            style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ryu-text-3)')}
          >
            Feedback
          </Link>
        </div>
      </div>
    </footer>
  )
}