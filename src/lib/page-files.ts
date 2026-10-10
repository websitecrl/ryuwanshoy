'use client'

import { toast } from 'sonner'
import { COMIC_PAGE_MAX_WIDTH, COMIC_PAGE_MAX_HEIGHT } from './constants'
import { compressImage, UNREADABLE_IMAGE_MESSAGE } from './image-compress'
import type { Tables } from '@/types/database'

// Shared by the three comic page uploaders (series wizard, new chapter page,
// edit chapter PageUploader) so they give the admin the same feedback for the
// same file.

/**
 * Keeps the image files and tells the admin about the rest.
 *
 * The file picker already hides non-images (accept="image/*"), but drag and
 * drop doesn't, and a dropped PDF used to vanish without a word. The wording
 * says "supported image" because some real images land here too: Windows
 * often gives .heic files no MIME type at all.
 *
 * @param files - files from an input or a drop event, in the browser's order
 * @returns only the image files, order preserved
 */
export function keepImageFiles(files: File[]): File[] {
  const images  = files.filter(f => f.type.startsWith('image/'))
  const skipped = files.filter(f => !f.type.startsWith('image/'))

  if (skipped.length === 1) {
    toast.warning(`Skipped "${skipped[0]!.name}": not a supported image type. Use JPG, PNG or WebP.`)
  } else if (skipped.length > 1) {
    const names = skipped.slice(0, 3).map(f => `"${f.name}"`).join(', ')
    const more  = skipped.length > 3 ? ` and ${skipped.length - 3} more` : ''
    toast.warning(`Skipped ${skipped.length} files that aren't supported images (use JPG, PNG or WebP): ${names}${more}.`)
  }
  return images
}

/**
 * Reads an image's pixel size without uploading it.
 *
 * @throws Error(UNREADABLE_IMAGE_MESSAGE) when the browser can't decode the
 *   file (corrupt, HEIC in Chrome, a renamed non-image). Without onerror the
 *   promise would never settle and the caller would hang.
 */
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(UNREADABLE_IMAGE_MESSAGE))
    }
    img.src = url
  })
}

/**
 * Warns when a page is bigger than the comic page size. Never blocks: every
 * page is shrunk to 1600px by compressImage before it's sent, so this is a
 * heads-up that it will be resized, not an error.
 *
 * Landscape images (spreads) are allowed twice the page width.
 *
 * @returns true when the warning was shown
 */
export function warnIfOversizedPage(file: File, width: number, height: number): boolean {
  const maxWidth  = width > height ? COMIC_PAGE_MAX_WIDTH * 2 : COMIC_PAGE_MAX_WIDTH
  if (width <= maxWidth && height <= COMIC_PAGE_MAX_HEIGHT) return false

  toast.warning(
    `"${file.name}" is ${width} × ${height} px (max ${maxWidth} × ${COMIC_PAGE_MAX_HEIGHT}). ` +
    'It will be resized automatically.'
  )
  return true
}

/** Every stored page is this many px tall, single or spread (see uploadComicPage). */
const PAGE_HEIGHT = 1600
/** Widest a stored spread may get (very wide panoramas). */
const MAX_SPREAD_WIDTH = 3200

/**
 * The one spread rule for every uploader: a landscape page (wider than
 * tall) is a double page spread. The wizard used to call anything wider
 * than 2550px a spread, which caught tall high resolution portrait scans.
 */
export function isSpreadPage(width: number, height: number): boolean {
  return width > height
}

/**
 * Compresses one page and appends it to the chapter (POST /api/pages).
 *
 * The API gives each page the next page_number, so callers must upload one
 * at a time, in reading order, and stop or report at the first failure.
 *
 * @param chapterId - the chapter the page belongs to
 * @param file - the original file; shrunk to PAGE_HEIGHT px tall as a JPEG
 *   here (pages are full-bleed art with no transparency, so JPEG is safe).
 *   Spreads get the same height, so each half keeps a single page's detail;
 *   capping the longest side instead squeezed a spread's two pages into
 *   one page's width.
 * @param isSpread - landscape double page
 * @returns the stored page row
 * @throws Error whose message is the reason, ready to show the admin:
 *   unreadable image, network failure, or the API's own error text
 */
export async function uploadComicPage(
  chapterId: string,
  file: File,
  isSpread: boolean
): Promise<Tables<'pages'>> {
  const { width, height } = await readImageSize(file)
  const maxDimension = isSpread
    ? Math.min(MAX_SPREAD_WIDTH, Math.max(PAGE_HEIGHT, Math.round(PAGE_HEIGHT * width / height)))
    : PAGE_HEIGHT
  const imageBase64 = await compressImage(file, { maxDimension, forceJpeg: true })

  let res: Response
  try {
    res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_id: chapterId, imageBase64, is_spread: isSpread }),
    })
  } catch {
    // fetch only throws when no response came back at all.
    throw new Error('Network error. Check your connection and retry.')
  }

  const json = await res.json().catch(() => null) as { data?: Tables<'pages'>; error?: string } | null
  if (!res.ok || json?.error || !json?.data) {
    throw new Error(json?.error ?? `Upload failed (${res.status}).`)
  }
  return json.data
}

/** "Page 3 ("IMG_2041.heic"): <reason>" for toasts and per-page errors. */
export function describePageError(pageNumber: number, file: File, err: unknown): string {
  const reason = err instanceof Error && err.message ? err.message : 'Upload failed.'
  // API messages don't all end in a period; callers append more sentences.
  return `Page ${pageNumber} ("${file.name}"): ${/[.!?]$/.test(reason) ? reason : `${reason}.`}`
}
