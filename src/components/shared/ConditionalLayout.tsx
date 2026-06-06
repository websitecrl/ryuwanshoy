'use client'

import { usePathname } from "next/navigation"
import Navbar from "./Navbar"
import Footer from "./Footer"

export default function ConditionalLayout({
    children,
    siteTitle,
    logoUrl,
}: {
    children: React.ReactNode
    siteTitle?: string | null
    logoUrl?: string | null
}) {
    const pathname = usePathname()

    const isAdminRoute = pathname.startsWith('/admin')
    const isReaderRoute = /^\/comics\/[^/]+\/[^/]+/.test(pathname)

    if (isAdminRoute || isReaderRoute) {
        return <>{children}</>
    }

    return (
        <>
            <Navbar siteTitle={siteTitle} logoUrl={logoUrl} />
            {children}
            <Footer />
        </>
    )
}