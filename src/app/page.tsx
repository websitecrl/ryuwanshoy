import { createClient } from '@/lib/supabase/server'
import HomeClient from './(components)/HomeClient'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const revalidate = 60

export async function generateMetadata() {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('site_title, site_description, logo_url')
      .single()

    const title = data?.site_title ?? 'Ryuwanshoy'
    const description = data?.site_description ?? 'A Filipino webcomic by Ryu'
    const image = data?.logo_url ?? '/og-default.png'

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
        series:series_id (
          title,
          slug,
          cover_image,
          min_age,
          is_published
        )
      `)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(6)

    if (error) throw error

    // Also filter out chapters whose series is unpublished
    return (data ?? []).filter(ch => {
      const series = ch.series as unknown as { is_published: boolean } | null
      return series?.is_published === true
    })
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

async function getSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('site_title, creator_name, site_description, logo_url')
      .single()

    if ( error ) throw error
    return data 
  } catch {
    return null
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