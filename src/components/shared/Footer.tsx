import Link from 'next/link'

const footerLinks = [
  { label: 'Home',          href: '/' },
  { label: 'Comics',        href: '/comics' },
  { label: 'Illustrations', href: '/posts' },
  { label: 'Support',       href: '/donate' },
]

const socialLinks = [
  { label: 'Facebook',    href: 'https://facebook.com',  icon: 'ti-brand-facebook' },
  { label: 'Instagram',   href: 'https://instagram.com', icon: 'ti-brand-instagram' },
  { label: 'Twitter / X', href: 'https://X.com',         icon: 'ti-brand-x' },
  { label: 'YouTube',     href: 'https://youtube.com',   icon: 'ti-brand-youtube' },
  { label: 'TikTok',      href: 'https://tiktok.com',    icon: 'ti-brand-tiktok' },
]

export default function Footer() {
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
        {/* Left — copyright */}
        <p
          className="font-reader"
          style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}
        >
          © {currentYear} Ryuwanshoy · all comics by Ryu
        </p>

        {/* Center — nav links (hidden on mobile) */}
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

        {/* Right — social icons */}
        <div className="flex items-center gap-5">
          {socialLinks.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              style={{ color: 'var(--ryu-text-3)', fontSize: 20, transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ryu-text-3)')}
            >
              <i className={`ti ${icon}`} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}