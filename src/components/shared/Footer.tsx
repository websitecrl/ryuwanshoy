import Link from 'next/link'
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

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '0.5px solid var(--ryu-border)',
        background: 'var(--ryu-surface-1)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between px-8"
        style={{ maxWidth: 1600, height: 80 }}
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

        {/* Right — nav links (hidden on mobile) */}
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
      </div>
    </footer>
  )
}