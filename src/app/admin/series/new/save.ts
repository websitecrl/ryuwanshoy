import { compressImage } from '@/lib/image-compress'
import { type LocalPage, type SeriesFormData } from './types'

// Fetch helpers for the wizard's single save point. The wizard writes nothing
// to the DB until "Save as draft" or "Publish"; rows are always created
// unpublished and only flipped live once every page has uploaded.

/**
 * Checks whether a slug is free. GET /api/series/[slug] finds any series for
 * an admin (published or not) and 404s when none matches.
 *
 * @returns true = free, false = taken, null = couldn't check
 */
export async function isSlugAvailable(slug: string): Promise<boolean | null> {
  try {
    const res = await fetch(`/api/series/${encodeURIComponent(slug)}`)
    if (res.status === 404) return true
    if (res.ok) return false
    return null
  } catch {
    return null
  }
}

/** Creates the series unpublished and returns its id. Throws with the API's message. */
export async function createSeries(data: SeriesFormData): Promise<string> {
  let coverImageBase64: string | undefined
  try {
    // Cover cards render at 460x640 — 1280px longest side is plenty of
    // headroom for retina without shipping a multi-MB original.
    if (data.coverFile) coverImageBase64 = await compressImage(data.coverFile, { maxDimension: 1280 })
  } catch {
    throw new Error('Failed to process images')
  }

  const res = await fetch('/api/series', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: data.title.trim(), slug: data.slug.trim().toLowerCase(),
      description: data.description || null, genre: data.genre || null,
      status: data.status, is_published: false,
      coverImageBase64,
      min_age: data.minAge,
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data.id
}

/** Creates chapter 1 unpublished and returns its id. Throws with the API's message. */
export async function createChapter(seriesId: string, title: string): Promise<string> {
  const res = await fetch('/api/chapters', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      series_id:       seriesId,
      chapter_number:  1,
      title:           title.trim() || null,
      is_early_access: false,
      is_published:    false,
      published_at:    new Date().toISOString(),
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data.id
}

/**
 * Uploads one page. The API appends it as the chapter's last page, so callers
 * must upload in reading order and stop at the first failure.
 *
 * @returns true when the page was stored
 */
export async function uploadPage(chapterId: string, page: LocalPage): Promise<boolean> {
  try {
    // Same fix as the standalone PageUploader — shrink before sending so
    // the Worker never has to decode/hash a raw 2550x3300 original.
    const imageBase64 = await compressImage(page.file, { maxDimension: 1600, forceJpeg: true })
    const res  = await fetch('/api/pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_id: chapterId, imageBase64, is_spread: page.is_spread ?? false }),
    })
    const json = await res.json()
    return res.ok && !json.error
  } catch {
    return false
  }
}

/** Sets is_published on a series or chapter. Throws with the API's message. */
export async function setPublished(kind: 'series' | 'chapters', id: string): Promise<void> {
  const res = await fetch(`/api/${kind}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_published: true }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? `Failed to publish ${kind === 'series' ? 'series' : 'chapter'}`)
}
