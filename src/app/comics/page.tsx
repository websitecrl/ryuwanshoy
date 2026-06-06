import { createClient } from '@/lib/supabase/server'
import SeriesGrid from '@/components/admin/reader/SeriesGrid'

export async function generateMetadat() {
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

export const revalidate = 60

export default async function ComicsPage() {
  const supabase = await createClient()

  const [
    { data: seriesData },
    { data: chaptersData },
    { count: pagesCount },
  ] = await Promise.all([
    supabase
      .from('series')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),

    supabase
      .from('chapters')
      .select('id, series_id')
      .eq('is_published', true),

    supabase
      .from('pages')
      .select('*', { count: 'exact', head: true }),
  ])

  const series = seriesData ?? []
  const chapters = chaptersData ?? []

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