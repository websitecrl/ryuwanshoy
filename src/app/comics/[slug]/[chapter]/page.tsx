import { cache } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery, nullIfNotFound, PublicNotFoundError } from '@/lib/cache/public-cache'
import ReaderShell from '@/components/reader/ReaderShell'

// The HTML is rendered per request, like before caching (see connection() in
// the page); only the Supabase reads are cached. Page level ISR would also
// store a page for every random URL, because unknown chapters currently
// render the not-found page with a 200 status (a known soft 404, see Plan.md).

type AdjacentChapter = { chapter_number: number } | null

// Cached across requests. A missing series/chapter throws PublicNotFoundError
// so it is not cached (bots probing random URLs must not fill the cache); a
// Supabase error throws so a hiccup is never cached either.
const queryChapterData = cachedPublicQuery('comics:chapter', async (slug: string, chapterNumber: number) => {
  const supabase = createPublicClient()

  // 1. Series (published only)
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, title, slug, cover_image, status')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (seriesError) throw seriesError
  if (!series) throw new PublicNotFoundError(`series "${slug}"`)

  // 2. Chapter, prev, next, and all chapters only depend on the series
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

    // For the chapter picker in the top bar
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

  // 3. Pages
  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('id, image_url, page_number, chapter_id, is_spread')
    .eq('chapter_id', chapter.id)
    .order('page_number', { ascending: true })

  // Without this, a failed read would cache "This chapter has no pages yet."
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

// cache() dedupes the call between generateMetadata and the page render.
// Returns null when the series or chapter doesn't exist (or isn't published).
const getChapterData = cache((slug: string, chapterNumber: number) =>
  nullIfNotFound(queryChapterData(slug, chapterNumber))
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}): Promise<Metadata> {
  const { slug, chapter } = await params
  const chapterNumber = parseInt(chapter, 10)
  if (isNaN(chapterNumber)) return { title: 'Not Found' }

  const data = await getChapterData(slug, chapterNumber)
  if (!data) return { title: 'Chapter Not Found' }

  const title = `${data.series.title} — Chapter ${chapterNumber}${
    data.chapter.title ? `: ${data.chapter.title}` : ''
  }`
  return {
    title: `${title} | Ryuwanshoy`,
    description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
    openGraph: {
      title: `${title} | Ryuwanshoy`,
      description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'}/comics/${slug}/${chapterNumber}`,
      images: data.series.cover_image
        ? [{ url: data.series.cover_image, width: 460, height: 640 }]
        : [{ url: '/og-default.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Ryuwanshoy`,
      description: `Read ${data.series.title} Chapter ${chapterNumber} free on Ryuwanshoy.`,
      images: data.series.cover_image
        ? [data.series.cover_image]
        : ['/og-default.png'],
    },
  }
}

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}) {
  // Render per request (as before caching); the data underneath is cached.
  // Not `dynamic = 'force-dynamic'`: that also disables unstable_cache,
  // which would send every view back to Supabase.
  await connection()

  const { slug, chapter } = await params
  const chapterNumber = parseInt(chapter, 10)

  if (isNaN(chapterNumber)) notFound()

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
    <ReaderShell
      series={data.series}
      chapter={data.chapter}
      pages={data.pages}
      allChapters={data.allChapters}
      prevChapter={data.prevChapter}
      nextChapter={data.nextChapter}
    />
  )
}