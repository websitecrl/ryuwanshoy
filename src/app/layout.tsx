import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Fraunces, JetBrains_Mono, Bangers, Quicksand } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/shared/ConditionalLayout";
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
      .select('site_title, logo_url')
      .single()
    return data 
  } catch {
    return null
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ryuwanshoy",
  description: "Comics by K-OS",
};

export default async function RootLayout({ children,}: Readonly<{
  children: React.ReactNode;
}>) {

  const settings = await getSiteSettings()
  return (
    <html
      lang="en"
      className={`
        ${geistSans.variable}
        ${geistMono.variable}
        ${inter.variable}
        ${fraunces.variable}
        ${jetbrainsMono.variable}
        ${bangers.variable}
        ${quicksand.variable}
        h-full antialiased
      `}
    >
      <head>
        <link
         rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ConditionalLayout siteTitle={settings?.site_title ?? null}>
          {children}
        </ConditionalLayout>
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}