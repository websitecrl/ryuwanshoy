'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
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
  // ?from= -> feedback form knows the page
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
      {/* minHeight + wrap -> no overflow on narrow phones */}
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-8 py-4"
        style={{ maxWidth: 1600, minHeight: 80 }}
      >
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
          {/* soft pill, --ryu-text for contrast */}
          <Link
            href={feedbackHref}
            prefetch={false}
            className="font-reader inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
                       text-[13px] font-semibold transition-colors
                       border-[var(--ryu-border)] bg-[var(--ryu-primary-soft)] text-[var(--ryu-text)]
                       hover:bg-[var(--ryu-primary)] hover:border-[var(--ryu-primary)] hover:text-[var(--ryu-on-primary)]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ryu-primary)]"
          >
            <MessageSquare size={14} aria-hidden="true" />
            Send feedback
          </Link>
        </div>
      </div>
    </footer>
  )
}