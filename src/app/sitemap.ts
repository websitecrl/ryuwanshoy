import { supabaseAdmin } from '@/lib/supabase/admin'

export const revalidate = 3600 // rebuild sitemap every hour

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/comics`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/posts`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${baseUrl}/donate`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
  ]

  // Dynamic series pages
  const { data: series } = await supabaseAdmin
    .from('series')
    .select('slug, created_at')
    .eq('is_published', true)

  const seriesPages = (series ?? []).map(s => ({
    url: `${baseUrl}/comics/${s.slug}`,
    lastModified: s.created_at ? new Date(s.created_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Dynamic chapter pages
  const { data: chapters } = await supabaseAdmin
    .from('chapters')
    .select('chapter_number, series:series_id(slug), published_at')
    .eq('is_published', true)
    .eq('is_draft', false)

  const chapterPages = (chapters ?? [])
    .filter(ch => ch.series && (ch.series as { slug: string }).slug)
    .map(ch => ({
      url: `${baseUrl}/comics/${(ch.series as { slug: string }).slug}/${ch.chapter_number}`,
      lastModified: new Date(ch.published_at ?? new Date()),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

  return [...staticPages, ...seriesPages, ...chapterPages]
}