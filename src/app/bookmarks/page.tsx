import { createClient } from '@/lib/supabase/server'
import BookmarksGrid from '@/components/shared/BookmarksGrid'

export function generateMetadata() {
  return {
    title: 'Your Bookmarks | Ryuwanshoy',
    description: 'Series you\'ve bookmarked to read later.',
  }
}

export const dynamic = 'force-dynamic'

export default async function BookmarksPage() {
  const supabase = await createClient()

  const [{ data: seriesData }, { data: chaptersData }] = await Promise.all([
    supabase
      .from('series')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),

    supabase
      .from('chapters')
      .select('id, series_id')
      .eq('is_published', true),
  ])

  const series = seriesData ?? []
  const chapters = chaptersData ?? []

  const chapterCounts: Record<string, number> = {}
  for (const ch of chapters) {
    if (ch.series_id) {
      chapterCounts[ch.series_id] = (chapterCounts[ch.series_id] ?? 0) + 1
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      <BookmarksGrid series={series} chapterCounts={chapterCounts} />
    </main>
  )
}
