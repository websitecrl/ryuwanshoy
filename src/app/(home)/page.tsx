import { connection } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'
import HomeClient from '@/app/(components)/HomeClient'
import { getSettingsOrThrow } from '@/lib/settings'

export async function generateMetadata() {
  const data = await getSettingsOrThrow()

  const title = data?.site_title ?? 'Ryuwanshoy'
  const description = data?.site_description ?? 'A Filipino webcomic by Ryu'
  // og-default, not the logo (wrong size for share cards)
  const image = '/og-default.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com',
      siteName: title,
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

// throw on error -> not cached
const getHeroSlides = cachedPublicQuery('home:hero-slides', async () => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('hero_slides')
    .select(`
      id,
      headline,
      banner_image,
      is_visible,
      order_index,
      series:series_id (
        title,
        slug,
        min_age
      ),
      chapter: chapter_id (
        id,
        chapter_number
      )
    `)
    .eq('is_visible', true)
    .order('order_index', { ascending: true })

  if (error) throw error
  return data ?? []
})

const getLatestChapters = cachedPublicQuery('home:latest-chapters', async () => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      id,
      title,
      chapter_number,
      is_early_access,
      published_at,
      is_published,
      series:series_id!inner (
        title,
        slug,
        cover_image,
        min_age,
        is_published
      )
    `)
    .eq('is_published', true)
    .eq('is_draft', false)
    .eq('series.is_published', true)
    .order('published_at', { ascending: false })
    .limit(6)

  if (error) throw error
  return data ?? []
})

const getRecentPosts = cachedPublicQuery('home:recent-posts', async () => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, image_url, post_type, created_at')
    .order('created_at', { ascending: false })
    .limit(4)

  if (error) throw error
  return data ?? []
})

// per request (no saved page copy -> never stale after an admin save); data stays cached
export default async function HomePage() {
  await connection()

  const [heroSlides, latestChapters, recentPosts, settings] = await Promise.all([
    getHeroSlides(),
    getLatestChapters(),
    getRecentPosts(),
    getSettingsOrThrow(),
  ]);

  return (
    <main>
      <HomeClient
        initialHeroSlides={heroSlides}
        initialChapters={latestChapters}
        initialPosts={recentPosts}
        settings={settings}
      />
    </main>
  );
}