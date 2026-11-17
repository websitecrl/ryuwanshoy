'use client'

import { usePathname } from "next/navigation"
import Navbar from "./Navbar"
import Footer from "./Footer"

type Props = {
  children: React.ReactNode
  siteTitle?: string | null
  logoUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  twitterUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

export default function ConditionalLayout({
  children,
  siteTitle,
  logoUrl,
  facebookUrl,
  instagramUrl,
  twitterUrl,
  youtubeUrl,
  tiktokUrl,
}: Props) {
  const pathname = usePathname()

  const isAdminRoute = pathname.startsWith('/admin')
  const isReaderRoute = /^\/comics\/[^/]+\/[^/]+/.test(pathname)

  if (isAdminRoute || isReaderRoute) {
    return <>{children}</>
  }

  // reader-root scopes the motion rules in globals.css ("Reader motion").
  // `contents`: the wrapper has no box, so <body>'s flex column still lays out
  // the navbar, page and footer exactly as before.
  return (
    <div className="reader-root contents">
      <Navbar siteTitle={siteTitle} logoUrl={logoUrl} />
      {children}
      <Footer
        facebookUrl={facebookUrl}
        instagramUrl={instagramUrl}
        twitterUrl={twitterUrl}
        youtubeUrl={youtubeUrl}
        tiktokUrl={tiktokUrl}
      />
    </div>
  )
}