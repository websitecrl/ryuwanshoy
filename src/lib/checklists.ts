export type ChecklistItem = {
  label: string
  done: boolean
  /** true -> publishing is blocked until this item is done (the rest are advice) */
  required?: boolean
}

// shared with the Drafts list -> badges match the edit pages

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
}): ChecklistItem[] {
  return [
    { label: 'Chapter # set',                done: input.chapterNumber > 0 },
    // required: a published chapter with no pages shows readers an empty reader
    { label: 'At least 1 page uploaded',      done: input.pagesCount > 0, required: true },
    { label: 'Pages named/ordered correctly', done: input.pagesOrderedCorrectly },
    { label: 'Publish date set',              done: !!input.publishedAt && input.publishedAt.trim().length > 0 },
    { label: 'Parent series is published',    done: input.seriesPublished },
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

/**
 * Required checklist items that are still missing.
 *
 * @param items - a checklist from getChapterChecklist / getSeriesChecklist
 * @returns the items that block publishing; empty -> ok to publish
 */
export function publishBlockers(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter(item => item.required === true && !item.done)
}

export function checklistSummary(items: ChecklistItem[]) {
  const completedCount = items.filter(i => i.done).length
  return { completedCount, totalCount: items.length }
}
