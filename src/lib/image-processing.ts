import 'server-only'
import { PhotonImage, SamplingFilter, resize, initPhoton } from '@cf-wasm/photon/others'

// Replaces sharp AND the Cloudflare Images binding.
//
// sharp: can't run on Workers — its wasm32 loader calls WebAssembly.compile()
// at runtime, which Workers blocks.
//
// Cloudflare Images binding (env.IMAGES): hit a reproducible platform-level
// crash inside Cloudflare's own internal code (cloudflare-internal:images-api,
// function serializeTextSource, "Cannot read properties of undefined (reading
// 'font')"). Confirmed via wrangler tail across many tests — happened even
// with a blank white PNG and Cloudflare's own literal minimal example from
// their docs. Ruled out: file content, Buffer-vs-ArrayBuffer input shape,
// extra transform/output options, output format (webp vs jpeg), Sentry
// auto-instrumentation, account plan/billing.
//
// Photon (@cf-wasm/photon) is a WASM library bundled at BUILD time, not
// compiled at runtime like sharp, so it avoids that restriction. The plain
// "/workerd" entrypoint assumes an esbuild-native .wasm import, which our
// Next.js build (webpack, not esbuild, for the initial compile step before
// OpenNext repackages it) doesn't handle the same way — so we use the
// "/others" entrypoint with an explicit initPhoton() call instead, which is
// the pattern the package's own docs recommend for generic bundlers.
//
// Trade-off vs the old sharp setup: Photon's WebP encoder has no quality
// parameter — output uses its own fixed internal quality, not the 85% we
// used to specify explicitly. Resizing width still does most of the
// file-size work for comic pages; revisit with @jsquash/webp (which does
// support numeric quality) only if resulting file sizes turn out too large.
let photonReady: Promise<unknown> | null = null

function ensurePhotonInitialized() {
  if (!photonReady) {
    photonReady = initPhoton({
      module_or_path: new URL('@cf-wasm/photon/photon.wasm', import.meta.url),
    })
  }
  return photonReady
}

export async function processImageToWebp(
  buffer: Buffer,
  maxWidth: number,
  _quality = 85 // kept for call-site compatibility; Photon's webp encoder ignores this
): Promise<Buffer> {
  await ensurePhotonInitialized()

  const inputBytes = new Uint8Array(buffer)
  const inputImage = PhotonImage.new_from_byteslice(inputBytes)

  try {
    const originalWidth = inputImage.get_width()
    const originalHeight = inputImage.get_height()

    if (originalWidth <= maxWidth) {
      const outputBytes = inputImage.get_bytes_webp()
      return Buffer.from(outputBytes)
    }

    const scale = maxWidth / originalWidth
    const newHeight = Math.round(originalHeight * scale)

    const outputImage = resize(inputImage, maxWidth, newHeight, SamplingFilter.Lanczos3)
    try {
      const outputBytes = outputImage.get_bytes_webp()
      return Buffer.from(outputBytes)
    } finally {
      outputImage.free()
    }
  } finally {
    inputImage.free()
  }
}