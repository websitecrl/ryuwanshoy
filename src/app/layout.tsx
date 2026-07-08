import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/shared/ConditionalLayout";
import AgeGate from "@/components/shared/AgeGate";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from 'sonner'

export const revalidate = 0

async function getSiteTitle(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase 
      .from('settings')
      .select('site_title')
      .single()
    return data?.site_title ?? null
  }catch {
    return null
  }
}

async function getSiteSettings() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('settings')
      .select('site_title, logo_url, facebook_url, instagram_url, twitter_url, youtube_url, tiktok_url')
      .single()
    return data
  } catch {
    return null
  }
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

  const settings = await getSiteSettings()
  return (
    <html
      lang="en"
      className={`${fredoka.variable} h-full antialiased`}
    >
      <head>
        <link
         rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
        />
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