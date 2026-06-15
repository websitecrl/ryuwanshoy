import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ReaderShell from '@/components/reader/ReaderShell'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type AdjacentChapter = { chapter_number: number } | null

async function getChapterData(slug: string, chapterNumber: number) {
  const supabase = await createClient()

  // 1. Series
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, title, slug, cover_image, status')
    .eq('slug', slug)
    .single()

  if (seriesError || !series) return null

  // 2. Chapter
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, title, chapter_number, is_early_access, is_published, is_draft, published_at, series_id')
    .eq('series_id', series.id)
    .eq('chapter_number', chapterNumber)
    .eq('is_published', true)
    .eq('is_draft', false)
    .single()

  if (chapterError || !chapter) return null

  // 3. Pages
  const { data: pages } = await supabaseAdmin
    .from('pages')
    .select('id, image_url, page_number, chapter_id, is_spread')
    .eq('chapter_id', chapter.id)
    .order('page_number', { ascending: true })
  // 4. Prev chapter
  const { data: prevChapter } = await supabase
    .from('chapters')
    .select('chapter_number')
    .eq('series_id', series.id)
    .eq('is_published', true)
    .lt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 5. Next chapter
  const { data: nextChapter } = await supabase
    .from('chapters')
    .select('chapter_number')
    .eq('series_id', series.id)
    .eq('is_published', true)
    .gt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: true })
    .limit(1)
    .maybeSingle()

  // 6. All chapters — for the chapter picker in the top bar
  const { data: allChapters } = await supabase
    .from('chapters')
    .select('id, chapter_number, title, is_early_access')
    .eq('series_id', series.id)
    .eq('is_published', true)
    .eq('is_draft', false)
    .order('chapter_number', { ascending: true })

  return {
    series,
    chapter,
    pages:       pages       ?? [],
    allChapters: allChapters ?? [],
    prevChapter: prevChapter as AdjacentChapter,
    nextChapter: nextChapter as AdjacentChapter,
  }
}

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
  const { slug, chapter } = await params
  const chapterNumber = parseInt(chapter, 10)

  if (isNaN(chapterNumber)) notFound()

  const data = await getChapterData(slug, chapterNumber)
  if (!data) notFound()
  if (!data.chapter.is_published) notFound()

  if (data.pages.length === 0) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 text-sm">This chapter has no pages yet.</p>
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