'use client'

import { useState, useEffect } from 'react'
import type { Tables } from '@/types/database'
import ScrollReader from './ScrollReader'
import FlipReader from './FlipReader'
import ReaderTopBar, { type ReaderTheme } from './ReaderTopBar'

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
const BOOKMARK_KEY = 'ryu.reader.bookmarks'
const CONTINUE_KEY = 'continueReading'
const THEME_KEY    = 'ryu.reader.theme'

export default function ReaderShell({
  series,
  chapter,
  pages,
  allChapters,
  prevChapter,
  nextChapter,
}: Props) {
  const [mode,        setMode]        = useState<ReadMode>('scroll')
  const [bookmarked,  setBookmarked]  = useState(false)
  const [uiVisible,   setUiVisible]   = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [theme,       setTheme]       = useState<ReaderTheme>('dark')

  // Restore theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
  }, [])

  // Persist theme
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
  }, [theme])

  // Restore mode
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY) as ReadMode | null
      if (saved === 'flip' || saved === 'scroll') setMode(saved)
    } catch {}
  }, [])

  // Persist mode
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }, [mode])

  // Check bookmark state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY)
      const bookmarks: string[] = raw ? JSON.parse(raw) : []
      setBookmarked(bookmarks.includes(chapter.id))
    } catch {}
  }, [chapter.id])

  // Write reading progress
  useEffect(() => {
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
  }, [series.id, chapter, pages, currentPage])

  // Mark chapter done at last page
  useEffect(() => {
    if (currentPage >= pages.length) {
      try { localStorage.setItem(`ch-done-${chapter.id}`, 'true') } catch {}
    }
  }, [currentPage, pages.length, chapter.id])

  // Legacy continue reading
  useEffect(() => {
    try {
      localStorage.setItem(
        CONTINUE_KEY,
        JSON.stringify({
          seriesSlug:    series.slug,
          seriesTitle:   series.title,
          chapterNumber: chapter.chapter_number,
          chapterTitle:  chapter.title,
          coverImage:    series.cover_image,
        })
      )
    } catch {}
  }, [series, chapter])

  function toggleBookmark() {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY)
      const bookmarks: string[] = raw ? JSON.parse(raw) : []
      const exists  = bookmarks.includes(chapter.id)
      const updated = exists
        ? bookmarks.filter((id) => id !== chapter.id)
        : [...bookmarks, chapter.id]
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated))
      setBookmarked(!exists)
    } catch {}
  }

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
    <div
      suppressHydrationWarning
      className={`min-h-screen flex flex-col ${
        theme === 'light' ? 'bg-[#FFFBF5]' : 'bg-[#0a0a0a]'
      }`}
    >
      <ReaderTopBar
        seriesTitle={series.title}
        seriesSlug={series.slug}
        chapterLabel={chapterLabel}
        currentChapterNumber={chapter.chapter_number}
        allChapters={allChapters}
        mode={mode}
        onModeChange={setMode}
        bookmarked={bookmarked}
        onBookmark={toggleBookmark}
        visible={uiVisible}
        onToggleVisibility={() => setUiVisible((v) => !v)}
        prevHref={prevHref}
        nextHref={nextHref}
        totalPages={pages.length}
        theme={theme}
        onThemeChange={setTheme}
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
            theme={theme}
          />
        ) : (
          <FlipReader
            pages={pages}
            seriesSlug={series.slug}
            seriesTitle={series.title}
            coverImage={series.cover_image}
            chapterNumber={chapter.chapter_number}
            prevHref={prevHref}
            nextHref={nextHref}
            uiVisible={uiVisible}
            onToggleUI={() => setUiVisible((v) => !v)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            theme={theme}
          />
        )}
      </main>
    </div>
  )
}