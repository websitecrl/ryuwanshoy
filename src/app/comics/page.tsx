import { connection } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'
import SeriesGrid from '@/components/reader/SeriesGrid'

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

// error -> throw -> not cached. bump version when the shape changes
const getComicsData = cachedPublicQuery('comics:index:v2', async () => {
  const supabase = createPublicClient()

  const [seriesRes, pagesRes] = await Promise.all([
    // chapters(count) per series; no !inner -> 0-chapter series still show
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

  const chapterCounts: Record<string, number> = {}
  const series = (seriesRes.data ?? []).map(({ chapters, ...row }) => {
    chapterCounts[row.id] = Number(chapters?.[0]?.count ?? 0)
    return row
  })

  return { series, chapterCounts, pagesCount: pagesRes.count ?? 0 }
})

// per request -> no-store (browsers can't reuse an old copy after an admin save); data stays cached
export default async function ComicsPage() {
  await connection()

  const { series, chapterCounts, pagesCount } = await getComicsData()

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