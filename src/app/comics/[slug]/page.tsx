import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import type { ChapterWithPageCount } from '@/types/reader'
import SeriesHeader from '@/components/shared/SeriesHeader'
import ChapterList from '@/components/shared/ChapterList'
import SeriesComments from '@/components/reader/SeriesComments'

export const dynamic = 'force-dynamic'

// Raw shape Supabase returns before we map it —
// pages(count) comes back as [{ count: number | string }]
type RawChapter = Tables<'chapters'> & {
  pages: { count: number | string }[]
}

type RawSeries = Tables<'series'> & {
  chapters: RawChapter[]
}

async function getSeriesBySlug(slug: string): Promise<{
  series: Tables<'series'>
  chapters: ChapterWithPageCount[]
  totalPages: number
  lastPublishedAt: string | null
} | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('series')
      .select(`
        *,
chapters (
          id,
          series_id,
          title,
          chapter_number,
          is_early_access,
          is_published,
          published_at,
          created_at,
          pages (count)
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .order('chapter_number', { referencedTable: 'chapters', ascending: true })
      .single()

    if (error || !data) return null

    const raw = data as unknown as RawSeries

// Filter drafts server-side — only pass published chapters to the client
    const chapters: ChapterWithPageCount[] = (raw.chapters ?? [])
      .filter(ch => ch.is_published === true)
      .map(ch => ({
        ...ch,
        page_count: Number(ch.pages?.[0]?.count ?? 0),
      }))

    const totalPages = chapters.reduce((sum, ch) => sum + ch.page_count, 0)

    const lastPublishedAt =
      chapters.length > 0
        ? ([...chapters].sort(
            (a, b) =>
              new Date(b.published_at!).getTime() -
              new Date(a.published_at!).getTime()
          )[0]?.published_at ?? null)
        : null

    return {
      series: data as Tables<'series'>,
      chapters,
      totalPages,
      lastPublishedAt,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const result = await getSeriesBySlug(slug)

  if (!result) return { title: 'Series Not Found' }

  const { series } = result
  return {
    title: `${series.title} | Ryuwanshoy`,
    description: series.description ?? `Read ${series.title} on Ryuwanshoy.`,
    openGraph: {
      title: `${series.title} | Ryuwanshoy`,
      description: series.description ?? `Read ${series.title} on Ryuwanshoy.`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'}/comics/${series.slug}`,
      images: series.cover_image
        ? [{ url: series.cover_image, width: 460, height: 640 }]
        : [{ url: '/og-default.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${series.title} | Ryuwanshoy`,
      description: series.description ?? `Read ${series.title} on Ryuwanshoy.`,
      images: series.cover_image ? [series.cover_image] : ['/og-default.png'],
    },
  }
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await getSeriesBySlug(slug)

  if (!result) notFound()

  const { series, chapters, totalPages, lastPublishedAt } = result

  const firstChapterNumber = chapters[0]?.chapter_number ?? 1

  return (
    <main className="min-h-screen bg-[var(--background)] pt-16 animate-page-in">
      <SeriesHeader
        series={series}
        chapterCount={chapters.length}
        totalPages={totalPages}
        lastPublishedAt={lastPublishedAt}
        firstChapterNumber={firstChapterNumber}
      />
      <ChapterList
        chapters={chapters}
        seriesId={series.id}
        seriesSlug={series.slug}
        seriesDescription={series.description}
      />
      <SeriesComments seriesId={series.id} />
    </main>
  )
}