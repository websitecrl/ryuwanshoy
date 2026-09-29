import { Fredoka } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/shared/ConditionalLayout";
import AgeGate from "@/components/shared/AgeGate";
import { getSettings } from "@/lib/settings";
import { Toaster } from 'sonner'
import { THEME_INIT_SCRIPT } from '@/lib/theme'

export const dynamic = 'force-dynamic'

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
    // suppressHydrationWarning: THEME_INIT_SCRIPT adds `dark` to <html> before
    // React hydrates, so the class list intentionally differs from the server's.
    <html
      lang="en"
      className={`${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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