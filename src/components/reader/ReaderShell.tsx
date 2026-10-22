'use client'

import { useState, useEffect } from 'react'
import type { Tables } from '@/types/database'
import { savedAgeAllows } from '@/hooks/useSavedAge'
import ScrollReader from './ScrollReader'
import FlipReader from './FlipReader'
import ReaderTopBar from './ReaderTopBar'

type Page = Tables<'pages'>

type ChapterSummary = {
  id: string
  chapter_number: number
  title: string | null
  is_early_access: boolean | null
}

type Props = {
  series: {
    id: string
    title: string
    slug: string
    cover_image: string | null
    min_age: number | null
  }
  chapter: {
    id: string
    title: string | null
    chapter_number: number
    is_early_access: boolean | null
  }
  pages: Page[]
  allChapters: ChapterSummary[]
  prevChapter: { chapter_number: number } | null
  nextChapter: { chapter_number: number } | null
}

type ReadMode = 'scroll' | 'flip'

const MODE_KEY     = 'ryu.reader.mode'
const CONTINUE_KEY = 'continueReading'

export default function ReaderShell({
  series,
  chapter,
  pages,
  allChapters,
  prevChapter,
  nextChapter,
}: Props) {
  const [mode,        setMode]        = useState<ReadMode>('scroll')
  const [uiVisible,   setUiVisible]   = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // ?mode= wins over the saved mode.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const urlMode = params.get('mode') as ReadMode | null
      if (urlMode === 'flip' || urlMode === 'scroll') {
        setMode(urlMode)
        return
      }
      const saved = localStorage.getItem(MODE_KEY) as ReadMode | null
      if (saved === 'flip' || saved === 'scroll') setMode(saved)
    } catch {}
  }, [])

  // Every save checks savedAgeAllows: a blocked chapter still mounts once on first load (spec 0003).

  useEffect(() => {
    if (!savedAgeAllows(series.min_age)) return
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }, [mode, series.min_age])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = parseInt(params.get('page') ?? '1', 10)
    if (!isNaN(page) && page > 1) setCurrentPage(page)
  }, [])

  // Only after page 1, so just opening a chapter link isn't saved as progress.
  useEffect(() => {
    if (currentPage <= 1 || !savedAgeAllows(series.min_age)) return
    try {
      localStorage.setItem(
        `reading-progress-${series.id}`,
        JSON.stringify({
          chapterNumber: chapter.chapter_number,
          chapterId:     chapter.id,
          title:         chapter.title,
          currentPage,
          totalPages:    pages.length,
          thumbnailUrl:  pages[0]?.image_url ?? null,
        })
      )
    } catch {}
  }, [series.id, series.min_age, chapter, pages, currentPage])

  useEffect(() => {
    if (currentPage >= pages.length && savedAgeAllows(series.min_age)) {
      try { localStorage.setItem(`ch-done-${chapter.id}`, 'true') } catch {}
    }
  }, [currentPage, pages.length, chapter.id, series.min_age])

  // Same page 1 guard as above.
  useEffect(() => {
    if (currentPage <= 1 || !savedAgeAllows(series.min_age)) return
    try {
      localStorage.setItem(
        CONTINUE_KEY,
        JSON.stringify({
          seriesSlug:    series.slug,
          seriesTitle:   series.title,
          chapterNumber: chapter.chapter_number,
          chapterTitle:  chapter.title,
          coverImage:    series.cover_image,
          currentPage,
        })
      )
    } catch {}
  }, [series, chapter, currentPage])

  const prevHref = prevChapter
    ? `/comics/${series.slug}/${prevChapter.chapter_number}`
    : null

  const nextHref = nextChapter
    ? `/comics/${series.slug}/${nextChapter.chapter_number}`
    : null

  const chapterLabel = chapter.title
    ? `Ch. ${chapter.chapter_number} — ${chapter.title}`
    : `Chapter ${chapter.chapter_number}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReaderTopBar
        seriesTitle={series.title}
        seriesSlug={series.slug}
        chapterLabel={chapterLabel}
        currentChapterNumber={chapter.chapter_number}
        allChapters={allChapters}
        mode={mode}
        onModeChange={setMode}
        visible={uiVisible}
        onToggleVisibility={() => setUiVisible((v) => !v)}
        prevHref={prevHref}
        nextHref={nextHref}
        totalPages={pages.length}
      />

      <main className="flex-1">
        {mode === 'scroll' ? (
          <ScrollReader
            pages={pages}
            totalPages={pages.length}
            uiVisible={uiVisible}
            onToggleUI={() => setUiVisible((v) => !v)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        ) : (
          <FlipReader
            pages={pages}
            seriesSlug={series.slug}
            prevHref={prevHref}
            nextHref={nextHref}
            uiVisible={uiVisible}
            onToggleUI={() => setUiVisible((v) => !v)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        )}
      </main>
    </div>
  )
}