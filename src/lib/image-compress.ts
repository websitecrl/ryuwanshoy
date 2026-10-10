'use client'

/** Shown when the browser can't decode a file (corrupt, HEIC in Chrome, renamed non-image). */
export const UNREADABLE_IMAGE_MESSAGE = "Couldn't read this image. Try saving it as JPG or PNG."

export interface CompressOptions {
  /** Longest side (width or height) is capped to this, aspect ratio preserved.
   *  Never upscales a smaller source image. Default 1600. */
  maxDimension?: number
  /** JPEG output quality, 0-1. Ignored when the output stays PNG. Default 0.85. */
  quality?: number
  /** Always output JPEG and skip the transparency check. Only for images
   *  known to be opaque (comic pages, hero banners): JPEG flattens any
   *  transparent area to black. Default false: the output format is picked
   *  per image (see compressImage). */
  forceJpeg?: boolean
}

/**
 * True when any pixel isn't fully opaque. Scans the alpha byte of every
 * pixel (every 4th byte of RGBA) and stops at the first one below 255.
 * About 2.5M pixels at 1600px, so it costs milliseconds in the browser.
 */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true
  }
  return false
}

/**
 * Resizes and compresses an image in the browser, before it's ever sent to
 * the server.
 *
 * Full-resolution admin uploads (comic pages up to 2550x3300px/25MB, but
 * also hero banners, post images, etc.) blow past Cloudflare Workers'
 * free-tier 10ms CPU budget once the Worker has to base64-decode them and
 * hash them again for R2's AWS SigV4 signing (see the "Worker exceeded CPU
 * time limit" errors in wrangler tail). Shrinking here, client-side, means
 * the Worker only ever touches a small payload — the CPU-heavy part never
 * happens on the server at all.
 *
 * Output format: JPEG, unless the image has transparent pixels (then PNG,
 * so the transparency survives). `forceJpeg` skips the check.
 *
 * @param file the original image file picked or dropped by the admin
 * @param opts see {@link CompressOptions}
 * @returns    a base64 data URL (JPEG or PNG) — same shape a raw FileReader
 *             output was, so callers don't otherwise change
 * @throws     if the browser can't decode the file as an image, or canvas
 *             isn't available (shouldn't happen in any real browser, but
 *             the admin dashboard should fail loudly instead of silently
 *             sending a bad payload)
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

      // Only scale DOWN — never upscale a smaller source image.
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

      // Decided by the pixels, not the file type: an opaque PNG (most art
      // exports) becomes a JPEG many times smaller, while anything with real
      // transparency stays PNG. Checking only PNGs used to send transparent
      // WebP/GIF stickers to JPEG, which turned their background black.
      // JPEG sources have no alpha channel, so they skip the scan.
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
