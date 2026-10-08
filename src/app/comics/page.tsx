import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'
import SeriesGrid from '@/components/admin/reader/SeriesGrid'

export async function generateMetadata() {
  return {
    title: 'Comics | Ryuwanshoy',
    description: 'Browse all free webcomics by Ryu — Filipino comics, skits, and more.',
    openGraph: {
      title: 'Comics | Ryuwanshoy',
      description: 'Browse all free webcomics by Ryu — Filipino comics, skits, and more.',
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'}/comics`,
      images: [{ url: '/og-default.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Comics | Ryuwanshoy',
      description: 'Browse all free webcomics by Ryu — Filipino comics, skits, and more.',
      images: ['/og-default.png'],
    },
  }
}

// ISR: see src/lib/cache/public-cache.ts.
export const revalidate = 60

// Throws on any Supabase error so a failed read is never cached (see
// cachedPublicQuery). Before caching, errors were ignored and the page
// rendered empty.
const getComicsData = cachedPublicQuery('comics:index', async () => {
  const supabase = createPublicClient()

  const [seriesRes, chaptersRes, pagesRes] = await Promise.all([
    supabase
      .from('series')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),

    // Same filter as the reader: published, not a draft, and in a published
    // series. Otherwise draft chapters inflate the counts on a cached page.
    supabase
      .from('chapters')
      .select('id, series_id, series:series_id!inner(is_published)')
      .eq('is_published', true)
      .eq('is_draft', false)
      .eq('series.is_published', true),

    supabase
      .from('pages')
      .select('*', { count: 'exact', head: true }),
  ])

  const error = seriesRes.error ?? chaptersRes.error ?? pagesRes.error
  if (error) throw error

  return {
    series: seriesRes.data ?? [],
    chapters: chaptersRes.data ?? [],
    pagesCount: pagesRes.count ?? 0,
  }
})

export default async function ComicsPage() {
  const { series, chapters, pagesCount } = await getComicsData()

  // Chapter counts per series
  const chapterCounts: Record<string, number> = {}
  for (const ch of chapters) {
    if (ch.series_id) {
      chapterCounts[ch.series_id] = (chapterCounts[ch.series_id] ?? 0) + 1
    }
  }

  // Stats for the header strip
  const stats = {
    series: series.length,
    chapters: chapters.length,
    pages: pagesCount ?? 0,
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--ryu-bg)' }}>
      <SeriesGrid
        series={series}
        chapterCounts={chapterCounts}
        stats={stats}
      />
    </main>
  )
}