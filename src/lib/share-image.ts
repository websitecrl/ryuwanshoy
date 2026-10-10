import { ALL_AGES, fitsAge } from '@/lib/age'

// The site wide link preview image (also the root layout's default).
const DEFAULT_SHARE_IMAGE = { url: '/og-default.png', width: 1200, height: 630 }

/**
 * The image a series or chapter link preview shows (og:image and
 * twitter:image). Previews in Messenger, Discord, Facebook and X are seen by
 * anyone, with no age gate, so only an all ages series shows its cover; a
 * 16+ or 18+ series (or one without a cover) gets the site default.
 *
 * @param series - the series row; min_age null counts as all ages
 * @returns one image for openGraph.images, with its size
 */
export function seriesShareImage(series: {
  cover_image: string | null
  min_age: number | null
}): { url: string; width: number; height: number } {
  if (series.cover_image && fitsAge(series.min_age, ALL_AGES)) {
    return { url: series.cover_image, width: 460, height: 640 }
  }
  return DEFAULT_SHARE_IMAGE
}
