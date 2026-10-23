import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 3600

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/comics`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/posts`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${baseUrl}/donate`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
  ]

  // anon client; error -> throw -> previous sitemap kept
  const supabase = createPublicClient()

  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('slug, created_at')
    .eq('is_published', true)

  if (seriesError) throw seriesError

  const seriesPages = (series ?? []).map(s => ({
    url: `${baseUrl}/comics/${s.slug}`,
    lastModified: s.created_at ? new Date(s.created_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // published chapters of published series (same rule as the reader)
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('chapter_number, series:series_id!inner(slug, is_published), published_at')
    .eq('is_published', true)
    .eq('is_draft', false)
    .eq('series.is_published', true)

  if (chaptersError) throw chaptersError

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