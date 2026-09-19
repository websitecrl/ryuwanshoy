'use client'

import { useState, useEffect } from 'react'
import type { Tables } from '@/types/database'
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

  // Restore mode = URL param takes priority over localStorage
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

  // Persist mode
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }, [mode])

  // Restore page from ?page= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = parseInt(params.get('page') ?? '1', 10)
    if (!isNaN(page) && page > 1) setCurrentPage(page)
  }, [])

  // Check bookmark state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY)
      const bookmarks: string[] = raw ? JSON.parse(raw) : []
      setBookmarked(bookmarks.includes(chapter.id))
    } catch {}
  }, [chapter.id])

  // Write reading progress
  //
  // Guarded on currentPage > 1: without this, the effect fires the instant
  // the page mounts — at page 1, before any real scrolling or page-turning —
  // so simply opening a chapter link got recorded as "reading progress"
  // identically to someone who actually read it.
  useEffect(() => {
    if (currentPage <= 1) return
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

  // Save continue reading (includes currentPage so resume works)
  //
  // Same guard, same reason as above: this used to fire on mount at page 1,
  // so the Home page's "Continue reading" card showed up the instant a
  // chapter link was opened, not only once someone had actually started
  // reading it.
  useEffect(() => {
    if (currentPage <= 1) return
    try {
      localStorage.setItem(
        CONTINUE_KEY,
        JSON.stringify({
          seriesSlug:    series.slug,
          seriesTitle:   series.title,
          chapterNumber: chapter.chapter_number,
          chapterTitle:  chapter.title,
          coverImage:    series.cover_image,
          currentPage,                          // ← was missing from dep array
        })
      )
    } catch {}
  }, [series, chapter, currentPage])            // ← currentPage added here

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
            seriesTitle={series.title}
            coverImage={series.cover_image}
            chapterNumber={chapter.chapter_number}
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