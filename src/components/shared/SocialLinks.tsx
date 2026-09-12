import { SiFacebook, SiInstagram, SiX, SiTiktok, SiYoutube } from 'react-icons/si'
import type { IconType } from 'react-icons'

type SocialLinksProps = {
  facebookUrl?: string | null
  instagramUrl?: string | null
  twitterUrl?: string | null
  tiktokUrl?: string | null
  youtubeUrl?: string | null
  size?: number
  className?: string
}

export default function SocialLinks({
  facebookUrl,
  instagramUrl,
  twitterUrl,
  tiktokUrl,
  youtubeUrl,
  size = 20,
  className,
}: SocialLinksProps) {
  const links = [
    { label: 'Facebook', href: facebookUrl, Icon: SiFacebook },
    { label: 'Instagram', href: instagramUrl, Icon: SiInstagram },
    { label: 'X (Twitter)', href: twitterUrl, Icon: SiX },
    { label: 'TikTok', href: tiktokUrl, Icon: SiTiktok },
    { label: 'YouTube', href: youtubeUrl, Icon: SiYoutube },
  ].filter((link): link is { label: string; href: string; Icon: IconType } =>
    typeof link.href === 'string' && link.href.trim() !== ''
  )

  if (links.length === 0) return null

  return (
    <div className={`flex items-center gap-3.5 ${className ?? ''}`}>
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          style={{ color: 'var(--ryu-text-2)', transition: 'color .15s', lineHeight: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ryu-text-2)')}
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  )
}
