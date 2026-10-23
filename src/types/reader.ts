import type { Tables } from './database'

/** chapter + pages(count) */
export type ChapterWithPageCount = Tables<'chapters'> & {
  page_count: number
}

/** localStorage reading-progress-{seriesId} */
export type ReadingProgress = {
  chapterNumber: number
  chapterId: string
  title: string | null
  currentPage?: number
  totalPages?: number
  thumbnailUrl?: string | null
}