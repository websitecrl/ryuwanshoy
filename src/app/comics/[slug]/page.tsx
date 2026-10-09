import { cache } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery, nullIfNotFound, PublicNotFoundError } from '@/lib/cache/public-cache'
import type { Tables } from '@/types/database'
import type { ChapterWithPageCount } from '@/types/reader'
import SeriesHeader from '@/components/shared/SeriesHeader'
import ChapterList from '@/components/shared/ChapterList'
import SeriesComments from '@/components/reader/SeriesComments'
import AgeRestricted from '@/components/shared/AgeRestricted'

// The HTML is rendered per request, like before caching (see connection() in
// the page); only the Supabase read is cached. Unknown slugs return a real
// 404 (notFound() below); that only works because AgeGate renders the page
// on the server, otherwise the not found signal never fired and Next sent 200.

// Cached across requests. A missing series throws PublicNotFoundError so it
// is not cached (bots probing random slugs must not fill the cache); a
// Supabase error throws so a hiccup is never cached either.
const querySeriesBySlug = cachedPublicQuery('comics:series', async (slug: string): Promise<{
  series: Tables<'series'>
  chapters: ChapterWithPageCount[]
  totalPages: number
  lastPublishedAt: string | null
}> => {
  const supabase = createPublicClient()

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
        is_draft,
        published_at,
        created_at,
        pages (count)
      )
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .order('chapter_number', { referencedTable: 'chapters', ascending: true })
    .maybeSingle()

  if (error) throw error
  if (!data) throw new PublicNotFoundError(`series "${slug}"`)

  // Supabase types the embedded rows from the select string, so no cast is
  // needed. Split chapters off: the series prop goes to the client, and it
  // would otherwise carry the whole chapter list a second time.
  const { chapters: rawChapters, ...series } = data

  // Filter drafts server-side — only pass published chapters to the client
  const chapters: ChapterWithPageCount[] = (rawChapters ?? [])
    .filter(ch => ch.is_published === true && ch.is_draft === false)
    .map(({ pages, ...ch }) => ({
      ...ch,
      // Number(): kept from before, in case PostgREST sends the count as a string
      page_count: Number(pages?.[0]?.count ?? 0),
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
    series,
    chapters,
    totalPages,
    lastPublishedAt,
  }
})

// cache() dedupes the call between generateMetadata and the page render.
// Returns null when the series doesn't exist (or isn't published).
const getSeriesBySlug = cache((slug: string) => nullIfNotFound(querySeriesBySlug(slug)))

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
  // Render per request (as before caching); the data underneath is cached.
  // Not `dynamic = 'force-dynamic'`: that also disables unstable_cache,
  // which would send every view back to Supabase.
  await connection()

  const { slug } = await params
  const result = await getSeriesBySlug(slug)

  if (!result) notFound()

  const { series, chapters, totalPages, lastPublishedAt } = result

  const firstChapterNumber = chapters[0]?.chapter_number ?? 1

  return (
    <AgeRestricted minAge={series.min_age}>
    <main className="min-h-screen bg-[var(--background)] animate-page-in">
      <SeriesHeader
        series={series}
        chapterCount={chapters.length}
        totalPages={totalPages}
        lastPublishedAt={lastPublishedAt}
        firstChapterNumber={firstChapterNumber}
        chapterIds={chapters.map(c => c.id)}
      />
      <ChapterList
        chapters={chapters}
        seriesId={series.id}
        seriesSlug={series.slug}
        seriesDescription={series.description}
      />
      <SeriesComments seriesId={series.id} />
    </main>
    </AgeRestricted>
  )
}