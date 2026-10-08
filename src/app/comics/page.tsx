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
// v2: the cached shape changed (chapterCounts instead of chapter rows), so a
// new key guarantees an old entry is never read as the new shape.
const getComicsData = cachedPublicQuery('comics:index:v2', async () => {
  const supabase = createPublicClient()

  const [seriesRes, pagesRes] = await Promise.all([
    // chapters(count) asks the database for one number per series instead of
    // downloading every chapter row. The chapters.* filters apply to what is
    // counted only (no !inner), so a series with 0 chapters still shows.
    // Same rule as the reader: published and not a draft (the series itself
    // is published by the outer filter).
    supabase
      .from('series')
      .select('*, chapters(count)')
      .eq('is_published', true)
      .eq('chapters.is_published', true)
      .eq('chapters.is_draft', false)
      .order('created_at', { ascending: false }),

    supabase
      .from('pages')
      .select('*', { count: 'exact', head: true }),
  ])

  const error = seriesRes.error ?? pagesRes.error
  if (error) throw error

  // Split the embedded count back out, so SeriesGrid gets plain series rows.
  const chapterCounts: Record<string, number> = {}
  const series = (seriesRes.data ?? []).map(({ chapters, ...row }) => {
    chapterCounts[row.id] = Number(chapters?.[0]?.count ?? 0)
    return row
  })

  return { series, chapterCounts, pagesCount: pagesRes.count ?? 0 }
})

export default async function ComicsPage() {
  const { series, chapterCounts, pagesCount } = await getComicsData()

  // Stats for the header strip
  const stats = {
    series: series.length,
    chapters: Object.values(chapterCounts).reduce((sum, n) => sum + n, 0),
    pages: pagesCount,
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