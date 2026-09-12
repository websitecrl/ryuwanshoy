export type ChecklistItem = { label: string; done: boolean }

// Shared with the Drafts list so its row badges can never drift from the
// checklist shown on the Chapter/Series edit pages — both read off this
// same source instead of keeping their own hardcoded field checks.

export function pagesOrderedCorrectly(pages: { page_number: number }[]): boolean {
  return pages.length > 0 &&
    [...pages]
      .sort((a, b) => a.page_number - b.page_number)
      .every((p, i) => p.page_number === i + 1)
}

export function getChapterChecklist(input: {
  chapterNumber: number
  pagesCount: number
  pagesOrderedCorrectly: boolean
  publishedAt: string | null
  seriesPublished: boolean
  title: string | null
}): ChecklistItem[] {
  return [
    { label: 'Chapter # set',                done: input.chapterNumber > 0 },
    { label: 'At least 1 page uploaded',      done: input.pagesCount > 0 },
    { label: 'Pages named/ordered correctly', done: input.pagesOrderedCorrectly },
    { label: 'Publish date set',              done: !!input.publishedAt && input.publishedAt.trim().length > 0 },
    { label: 'Parent series is published',    done: input.seriesPublished },
    { label: 'Title set',                     done: !!input.title && input.title.trim().length > 0 },
  ]
}

export function getSeriesChecklist(input: {
  title: string
  slug: string
  genre: string | null
  coverImage: string | null
}): ChecklistItem[] {
  return [
    { label: 'Title set',      done: input.title.trim().length > 0 },
    { label: 'Slug set',       done: input.slug.trim().length > 0 },
    { label: 'Genre set',      done: !!input.genre && input.genre.trim().length > 0 },
    { label: 'Cover uploaded', done: !!input.coverImage },
  ]
}

export function checklistSummary(items: ChecklistItem[]) {
  const completedCount = items.filter(i => i.done).length
  return { completedCount, totalCount: items.length }
}
