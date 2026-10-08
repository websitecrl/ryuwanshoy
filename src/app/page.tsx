import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'
import HomeClient from './(components)/HomeClient'
import { getSettingsOrThrow } from '@/lib/settings'

// ISR: served from cache, refreshed in the background at most once a minute,
// and purged right away by admin writes (revalidatePublicContent).
export const revalidate = 60

// No try/catch: a settings failure must throw, so ISR keeps the last good
// copy instead of caching the default title (see getSettingsOrThrow).
export async function generateMetadata() {
  const data = await getSettingsOrThrow()

  const title = data?.site_title ?? 'Ryuwanshoy'
  const description = data?.site_description ?? 'A Filipino webcomic by Ryu'
  // Not logo_url: the logo is small and not 1200×630, so share cards
  // cropped or rejected it.
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

// These throw on a Supabase error instead of returning []: a thrown error is
// never cached, and when a cached copy of this page exists ISR keeps serving
// it, rather than freezing an empty home page for every visitor.
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

export default async function HomePage() {
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