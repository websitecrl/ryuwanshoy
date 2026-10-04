import { createClient } from '@/lib/supabase/server'
import HomeClient from './(components)/HomeClient'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  try {
    const data = await getSettings()

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
        images: [{ url: image, width: 1200, height: 630}],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    }
  }catch {
    return { title: 'Ryuwanshoy' }
  }
}

async function getHeroSlides() {
  try {
    const supabase = await createClient()
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
  } catch {
    return []
  }
}

async function getLatestChapters() {
  try {
    const supabase = await createClient()
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
  } catch {
    return []
  }
}


async function getRecentPosts() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, image_url, post_type, created_at')
      .order('created_at', { ascending: false })
      .limit(4)

    if (error) throw error 
    return data ?? []
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [heroSlides, latestChapters, recentPosts, settings] = await Promise.all([
    getHeroSlides(),
    getLatestChapters(),
    getRecentPosts(),
    getSettings(),
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