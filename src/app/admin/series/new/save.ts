import { compressImage } from '@/lib/image-compress'
import { type SeriesFormData } from './types'

// Wizard save helpers. Rows are created unpublished and flipped live once every page uploads.

/** true = free, false = taken, null = couldn't check. */
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

export async function createSeries(data: SeriesFormData): Promise<string> {
  let coverImageBase64: string | undefined
  try {
    // Covers show at 460x640, so 1280px is plenty for retina.
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

export async function setPublished(kind: 'series' | 'chapters', id: string): Promise<void> {
  const res = await fetch(`/api/${kind}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_published: true }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? `Failed to publish ${kind === 'series' ? 'series' : 'chapter'}`)
}
