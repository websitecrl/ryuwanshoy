import type { Tables } from './database'

/** Chapter row from Supabase, augmented with computed page count from pages(count) */
export type ChapterWithPageCount = Tables<'chapters'> & {
  page_count: number
}

/**
 * Shape the chapter reader writes to localStorage.
 * Key: reading-progress-{seriesId}
 * currentPage / totalPages / thumbnailUrl are optional for backward compat.
 */
export type ReadingProgress = {
  chapterNumber: number
  chapterId: string
  title: string | null
  currentPage?: number
  totalPages?: number
  thumbnailUrl?: string | null
}