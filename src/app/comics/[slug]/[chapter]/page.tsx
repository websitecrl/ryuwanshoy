import { cache } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery, nullIfNotFound, PublicNotFoundError } from '@/lib/cache/public-cache'
import ReaderShell from '@/components/reader/ReaderShell'
import AgeRestricted from '@/components/shared/AgeRestricted'
import { seriesShareImage } from '@/lib/share-image'

// per request; Supabase reads cached; unknown -> real 404

type AdjacentChapter = { chapter_number: number } | null

// miss/error -> throw -> not cached. bump version when the shape changes
const queryChapterData = cachedPublicQuery('comics:chapter:v2', async (slug: string, chapterNumber: number) => {
  const supabase = createPublicClient()

  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, title, slug, cover_image, status, min_age')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (seriesError) throw seriesError
  if (!series) throw new PublicNotFoundError(`series "${slug}"`)

  const [
    { data: chapter, error: chapterError },
    { data: prevChapter, error: prevError },
    { data: nextChapter, error: nextError },
    { data: allChapters, error: allError },
  ] = await Promise.all([
    supabase
      .from('chapters')
      .select('id, title, chapter_number, is_early_access, is_published, is_draft, published_at, series_id')
      .eq('series_id', series.id)
      .eq('chapter_number', chapterNumber)
      .eq('is_published', true)
      .eq('is_draft', false)
      .maybeSingle(),

    supabase
      .from('chapters')
      .select('chapter_number')
      .eq('series_id', series.id)
      .eq('is_published', true)
      .eq('is_draft', false)
      .lt('chapter_number', chapterNumber)
      .order('chapter_number', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('chapters')
      .select('chapter_number')
      .eq('series_id', series.id)
      .eq('is_published', true)
      .eq('is_draft', false)
      .gt('chapter_number', chapterNumber)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('chapters')
      .select('id, chapter_number, title, is_early_access')
      .eq('series_id', series.id)
      .eq('is_published', true)
      .eq('is_draft', false)
      .order('chapter_number', { ascending: true }),
  ])

  const queryError = chapterError ?? prevError ?? nextError ?? allError
  if (queryError) throw queryError
  if (!chapter) throw new PublicNotFoundError(`chapter ${slug}/${chapterNumber}`)

  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('id, image_url, page_number, chapter_id, is_spread')
    .eq('chapter_id', chapter.id)
    .order('page_number', { ascending: true })

  if (pagesError) throw pagesError

  return {
    series,
    chapter,
    pages:       pages       ?? [],
    allChapters: allChapters ?? [],
    prevChapter: prevChapter as AdjacentChapter,
    nextChapter: nextChapter as AdjacentChapter,
  }
})

/** whole number only ("1abc", "01" would duplicate chapter 1) */
function parseChapterNumber(segment: string): number | null {
  return /^(0|[1-9]\d*)$/.test(segment) ? Number(segment) : null
}

// cache() -> one call for metadata + page
const getChapterData = cache((slug: string, chapterNumber: number) =>
  nullIfNotFound(queryChapterData(slug, chapterNumber))
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}): Promise<Metadata> {
  const { slug, chapter } = await params
  const chapterNumber = parseChapterNumber(chapter)
  if (chapterNumber === null) return { title: 'Not Found' }

  const data = await getChapterData(slug, chapterNumber)
  if (!data) return { title: 'Chapter Not Found' }

  const title = `${data.series.title} — Chapter ${chapterNumber}${
    data.chapter.title ? `: ${data.chapter.title}` : ''
  }`
  const shareImage = seriesShareImage(data.series)
  return {
    title: `${title} | Ryuwanshoy`,
    description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
    openGraph: {
      title: `${title} | Ryuwanshoy`,
      description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'}/comics/${slug}/${chapterNumber}`,
      images: [shareImage],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Ryuwanshoy`,
      description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
      images: [shareImage.url],
    },
  }
}

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}) {
  // per request; force-dynamic would also disable the data cache
  await connection()

  const { slug, chapter } = await params
  const chapterNumber = parseChapterNumber(chapter)

  if (chapterNumber === null) notFound()

  const data = await getChapterData(slug, chapterNumber)
  if (!data) notFound()
  if (!data.chapter.is_published) notFound()

  if (data.pages.length === 0) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--ryu-text-2)] text-sm">This chapter has no pages yet.</p>
        </div>
      </main>
    )
  }

  return (
    <AgeRestricted minAge={data.series.min_age}>
      <ReaderShell
        series={data.series}
        chapter={data.chapter}
        pages={data.pages}
        allChapters={data.allChapters}
        prevChapter={data.prevChapter}
        nextChapter={data.nextChapter}
      />
    </AgeRestricted>
  )
}