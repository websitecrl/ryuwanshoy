import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/shared/ConditionalLayout";
import AgeGate from "@/components/shared/AgeGate";
import { getSettings } from "@/lib/settings";
import { Toaster } from 'sonner'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import { AGE_INIT_SCRIPT } from '@/lib/age'

// metadataBase turns relative image URLs (/og-default.png) into absolute
// ones — Facebook and X ignore relative og:image URLs.
// The openGraph/twitter images are the share-card fallback for any page
// that doesn't set its own. Next merges metadata shallowly: a page that
// defines `openGraph` replaces this whole object, so it must list its own
// images.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'),
  openGraph: {
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.png'],
  },
}

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export default async function RootLayout({ children,}: Readonly<{
  children: React.ReactNode;
}>) {

  const settings = await getSettings()
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT adds `dark` and
    // AGE_INIT_SCRIPT adds data-age-confirmed to <html> before React hydrates,
    // so its attributes intentionally differ from the server's.
    <html
      lang="en"
      className={`${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: AGE_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AgeGate>
          <ConditionalLayout
              siteTitle={settings?.site_title ?? null}
              logoUrl={settings?.logo_url ?? null}
              facebookUrl={settings?.facebook_url ?? null}
              instagramUrl={settings?.instagram_url ?? null}
              twitterUrl={settings?.twitter_url ?? null}
              youtubeUrl={settings?.youtube_url ?? null}
              tiktokUrl={settings?.tiktok_url ?? null}
            >
            {children}
          </ConditionalLayout>
        </AgeGate>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}