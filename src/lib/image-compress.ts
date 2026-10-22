'use client'

/** Shown when the browser can't decode a file (corrupt, HEIC in Chrome, renamed non-image). */
export const UNREADABLE_IMAGE_MESSAGE = "Couldn't read this image. Try saving it as JPG or PNG."

export interface CompressOptions {
  /** Longest side cap, never upscales. Default 1600. */
  maxDimension?: number
  /** JPEG output quality, 0-1. Ignored when the output stays PNG. Default 0.85. */
  quality?: number
  /** Always JPEG, no transparency check. Only for opaque images: JPEG turns transparency black. */
  forceJpeg?: boolean
}

/** True when any pixel isn't fully opaque (stops at the first one). */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true
  }
  return false
}

/**
 * Resizes and compresses an image in the browser, so the Worker never handles a full-size upload (10ms CPU limit).
 * Returns a JPEG data URL, or PNG when the image has transparent pixels.
 */
export function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 1600, quality = 0.85, forceJpeg = false } = opts

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(
        1,
        maxDimension / Math.max(img.naturalWidth, img.naturalHeight)
      )
      const width  = Math.round(img.naturalWidth  * scale)
      const height = Math.round(img.naturalHeight * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas is not supported in this browser'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Decided by pixels, not file type: opaque PNGs shrink as JPEG, transparent WebP/GIF stay PNG.
      const keepAlpha = !forceJpeg && file.type !== 'image/jpeg' && hasTransparency(ctx, width, height)
      resolve(canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(UNREADABLE_IMAGE_MESSAGE))
    }

    img.src = objectUrl
  })
}
