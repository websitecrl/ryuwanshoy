'use client'

/**
 * Resizes and compresses an image in the browser, before it's ever sent to
 * the server.
 *
 * Comic pages come in at up to 2550x3300px / 25MB. Decoding a base64 string
 * that large, and then hashing it again for R2's AWS SigV4 signing, is what
 * was blowing past Cloudflare Workers' free-tier 10ms CPU budget (see the
 * "Worker exceeded CPU time limit" errors in wrangler tail). Shrinking the
 * image here, client-side, means the Worker only ever touches a small
 * payload — the CPU-heavy part never happens on the server at all.
 *
 * @param file         the original image file picked or dropped by the admin
 * @param maxDimension the longest side (width or height) is capped to this,
 *                      aspect ratio preserved. 1600px is 2x the 800px reader
 *                      width used in scroll mode, so it still looks sharp.
 * @param quality       JPEG quality, 0-1. 0.85 is visually lossless for
 *                      comic art and cuts file size drastically vs. the original.
 * @returns             a base64 data URL — same shape the old raw-file
 *                      FileReader output was, so callers don't change.
 * @throws              if the browser can't decode the file as an image,
 *                      or canvas isn't available (shouldn't happen in any
 *                      real browser, but the admin dashboard should fail
 *                      loudly instead of silently sending a bad payload).
 */
export function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
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

      // Comic pages are full-bleed art with speech bubbles baked in — no
      // transparency to preserve — so JPEG (much smaller than PNG) is
      // always the right output format here.
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image file'))
    }

    img.src = objectUrl
  })
}
