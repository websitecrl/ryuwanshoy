import { ALL_AGES, fitsAge } from '@/lib/age'

const DEFAULT_SHARE_IMAGE = { url: '/og-default.png', width: 1200, height: 630 }

/** Link preview image: the cover only for all ages series, since previews skip the age gate. */
export function seriesShareImage(series: {
  cover_image: string | null
  min_age: number | null
}): { url: string; width: number; height: number } {
  if (series.cover_image && fitsAge(series.min_age, ALL_AGES)) {
    return { url: series.cover_image, width: 460, height: 640 }
  }
  return DEFAULT_SHARE_IMAGE
}
