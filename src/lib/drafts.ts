import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteManyFromR2 } from '@/lib/r2'
import { filterUnsharedCovers } from '@/lib/series-covers'

// ─── What counts as a draft ───────────────────────────────────────────────────
// Single source of truth for the drafts badge, the "Delete all drafts" dialog
// and the bulk delete itself, so all three always agree.
//
// Draft chapter: is_published is not true. NOT is_draft — that flag is only
//   set at creation and the series wizard leaves it false on unpublished
//   chapters, so it misses real drafts. A published chapter never matches.
// Draft series: is_published is not true AND none of its chapters is
//   published. Deleting a series cascades to its chapters, pages, comments
//   and hero_slides, so this guarantees the cascade only ever removes draft
//   chapters. Series have no is_draft column; an unpublished series that
//   still has live chapters is "hidden", not a draft, and is never touched.

export type DraftSeriesItem = {
  id: string
  title: string
  chapterCount: number
}

export type DraftChapterItem = {
  id: string
  title: string | null
  chapter_number: number
  seriesTitle: string | null
}

export type DraftPreview = {
  /** Draft series — deleted with all their (draft) chapters. */
  series: DraftSeriesItem[]
  /** Draft chapters whose series is NOT a draft — deleted individually. */
  chapters: DraftChapterItem[]
  /** Every chapter that would be deleted, including those inside draft series. */
  totalChapters: number
  /** hero_slides that cascade away with draft series. */
  heroSlideCount: number
  /** Badge number: draft series + every draft chapter. */
  count: number
}

type WithImages<T> = T & { imageRefs: string[]; heroSlides: number; chapters: number; coverImage?: string | null }

async function findDraftTargets() {
  const [seriesRes, chaptersRes] = await Promise.all([
    supabaseAdmin
      .from('series')
      .select('id, title, cover_image, banner_image, chapters (id, is_published, pages (image_url)), hero_slides (banner_image)')
      .not('is_published', 'is', true)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('chapters')
      .select('id, title, chapter_number, series_id, pages (image_url), series (title)')
      .not('is_published', 'is', true)
      .order('created_at', { ascending: false }),
  ])
  if (seriesRes.error) throw seriesRes.error
  if (chaptersRes.error) throw chaptersRes.error

  const series: WithImages<DraftSeriesItem>[] = seriesRes.data
    .filter(s => s.chapters.every(c => c.is_published !== true))
    .map(s => ({
      id:           s.id,
      title:        s.title,
      chapterCount: s.chapters.length,
      chapters:     s.chapters.length,
      heroSlides:   s.hero_slides.length,
      // Kept out of imageRefs: a legacy cover may also back a series that
      // isn't being deleted, so it's checked separately before deletion.
      coverImage:   s.cover_image,
      imageRefs: [
        s.banner_image,
        ...s.hero_slides.map(h => h.banner_image),
        ...s.chapters.flatMap(c => c.pages.map(p => p.image_url)),
      ].filter((ref): ref is string => !!ref),
    }))

  const draftSeriesIds = new Set(series.map(s => s.id))

  const chapters: WithImages<DraftChapterItem>[] = chaptersRes.data
    .filter(c => !c.series_id || !draftSeriesIds.has(c.series_id))
    .map(c => ({
      id:             c.id,
      title:          c.title,
      chapter_number: c.chapter_number,
      seriesTitle:    c.series?.title ?? null,
      chapters:       1,
      heroSlides:     0,
      imageRefs:      c.pages.map(p => p.image_url).filter(Boolean),
    }))

  return { series, chapters }
}

function toPreview(
  series: WithImages<DraftSeriesItem>[],
  chapters: WithImages<DraftChapterItem>[],
): DraftPreview {
  const totalChapters  = [...series, ...chapters].reduce((n, x) => n + x.chapters, 0)
  const heroSlideCount = series.reduce((n, s) => n + s.heroSlides, 0)
  return {
    series:   series.map(({ id, title, chapterCount }) => ({ id, title, chapterCount })),
    chapters: chapters.map(({ id, title, chapter_number, seriesTitle }) => ({ id, title, chapter_number, seriesTitle })),
    totalChapters,
    heroSlideCount,
    count: series.length + totalChapters,
  }
}

/** What "Delete all drafts" would remove right now. */
export async function getDraftPreview(): Promise<DraftPreview> {
  const { series, chapters } = await findDraftTargets()
  return toPreview(series, chapters)
}

export type DeleteDraftsResult = {
  deleted: DraftPreview
  /** R2 objects that could not be removed (rows are already gone). */
  imageCleanupFailed: number
}

/**
 * Deletes the drafts the admin confirmed — only ids that were shown in the
 * dialog AND still match the draft rule now. Anything that became a draft
 * after the dialog opened, or stopped being one, is left alone.
 *
 * DB rows go first, then their R2 images (awaited, batched — see
 * deleteManyFromR2). Deleting images first would leave live rows pointing
 * at missing files if the DB delete then failed.
 */
export async function deleteConfirmedDrafts(confirmed: {
  seriesIds: string[]
  chapterIds: string[]
}): Promise<DeleteDraftsResult> {
  const targets    = await findDraftTargets()
  const seriesIds  = new Set(confirmed.seriesIds)
  const chapterIds = new Set(confirmed.chapterIds)

  const series   = targets.series.filter(s => seriesIds.has(s.id))
  const chapters = targets.chapters.filter(c => chapterIds.has(c.id))

  // The published guard is repeated in each DELETE so a row published
  // between the lookup above and here is still never removed.
  let deletedSeriesIds = new Set<string>()
  if (series.length) {
    const { data, error } = await supabaseAdmin
      .from('series')
      .delete()
      .in('id', series.map(s => s.id))
      .not('is_published', 'is', true)
      .select('id')
    if (error) throw error
    deletedSeriesIds = new Set(data.map(r => r.id))
  }

  let deletedChapterIds = new Set<string>()
  if (chapters.length) {
    const { data, error } = await supabaseAdmin
      .from('chapters')
      .delete()
      .in('id', chapters.map(c => c.id))
      .not('is_published', 'is', true)
      .select('id')
    if (error) throw error
    deletedChapterIds = new Set(data.map(r => r.id))
  }

  const deletedSeries   = series.filter(s => deletedSeriesIds.has(s.id))
  const deletedChapters = chapters.filter(c => deletedChapterIds.has(c.id))

  // Rows are gone by now, so only surviving series count as sharing a cover.
  const covers = await filterUnsharedCovers(
    deletedSeries.map(s => s.coverImage).filter((c): c is string => !!c)
  )
  const imageRefs = [...covers, ...[...deletedSeries, ...deletedChapters].flatMap(x => x.imageRefs)]
  const { failed } = imageRefs.length ? await deleteManyFromR2(imageRefs) : { failed: [] }
  if (failed.length) {
    console.error(`deleteConfirmedDrafts: ${failed.length} R2 object(s) not deleted:`, failed)
  }

  return {
    deleted: toPreview(deletedSeries, deletedChapters),
    imageCleanupFailed: failed.length,
  }
}
