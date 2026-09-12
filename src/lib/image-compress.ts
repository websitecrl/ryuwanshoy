'use client'

export interface CompressOptions {
  /** Longest side (width or height) is capped to this, aspect ratio preserved.
   *  Never upscales a smaller source image. Default 1600. */
  maxDimension?: number
  /** JPEG output quality, 0-1. Ignored when the output stays PNG. Default 0.85. */
  quality?: number
  /** Force JPEG output even for a PNG source. Only safe when the source is
   *  known to have no transparency (e.g. comic pages, which are full-bleed
   *  art with no alpha channel) — forcing JPEG on a transparent PNG flattens
   *  transparent areas to black. Default false: PNG in stays PNG out, so
   *  logos/stickers/banners with real transparency aren't corrupted. */
  forceJpeg?: boolean
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
 * @param file the original image file picked or dropped by the admin
 * @param opts see {@link CompressOptions}
 * @returns    a base64 data URL — same shape a raw FileReader output was,
 *             so callers don't otherwise change
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

      // PNG sources keep their transparency unless the caller explicitly
      // knows there's none to preserve (forceJpeg) — everything else
      // (JPEG/WEBP sources) already has no alpha, so JPEG out is always
      // the smaller, correct choice for them.
      const outputType = !forceJpeg && file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      resolve(canvas.toDataURL(outputType, quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image file'))
    }

    img.src = objectUrl
  })
}
