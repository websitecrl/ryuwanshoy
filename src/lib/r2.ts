import 'server-only'
import { AwsClient } from 'aws4fetch'
import { createHash } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'

// R2 is S3-compatible, so we talk to it with SigV4-signed HTTP requests.
//
// We use `aws4fetch` here instead of `@aws-sdk/client-s3`. The official AWS
// SDK is built for Node servers with no CPU budget — on Cloudflare Workers'
// free plan (10ms of CPU time per request, not wall-clock time), its request
// signing alone was enough to trip error 1102 ("Worker exceeded CPU time
// limit") on some uploads. `aws4fetch` is a ~6KB library built specifically
// for fetch-based runtimes like Workers — same SigV4 signing, far less
// overhead. See Cloudflare's own R2 docs, which use aws4fetch as the
// reference example for exactly this environment.
//
// Trade-off vs the old SDK: aws4fetch is a thin wrapper around plain
// `fetch()`, not a full client. Two things that used to be automatic are now
// explicit below: (1) a failed request does NOT throw on its own — a
// non-2xx response has to be checked manually — and (2) list/read
// operations return raw XML text instead of a parsed object, so
// `getR2StorageBytes` parses out just the fields it needs.

/**
 * Builds the R2 client + the raw config values every upload/delete/list call
 * needs.
 *
 * Validates required vars instead of using `!` non-null assertions — a
 * missing or malformed value here (e.g. R2_ENDPOINT accidentally carrying a
 * bucket-name suffix, or a stale R2_PUBLIC_URL after a bucket rename) used to
 * fail silently: uploads would still "succeed" but read/write the wrong
 * location. Now it throws immediately with the actual (non-secret) values,
 * so a misconfigured deploy shows up in the logs on the very first request
 * instead of as a mysterious 404 downstream.
 *
 * @throws if any required var is missing/blank, or if R2_ENDPOINT/R2_PUBLIC_URL
 *         carry a path segment (they must be bare origins — no trailing bucket name)
 */
function getR2() {
  const bucket    = process.env.R2_BUCKET_NAME ?? ''
  const endpoint  = process.env.R2_ENDPOINT ?? ''
  const publicUrl = process.env.R2_PUBLIC_URL ?? ''
  const eaBucket  = process.env.R2_EA_BUCKET_NAME ?? ''
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''

  const missing = Object.entries({ bucket, endpoint, publicUrl, eaBucket, accessKeyId, secretAccessKey })
    .filter(([, v]) => v.trim() === '')
    .map(([k]) => k)

  if (missing.length) {
    throw new Error(`R2 misconfigured — missing env var(s): ${missing.join(', ')}`)
  }

  // endpoint/publicUrl must be bare origins. A bucket name (or anything else)
  // tacked onto the path here would get silently prepended to every object
  // key below (we build the full path ourselves — see uploadToR2 etc.) —
  // the exact bug that caused covers to land under an extra "<bucket>/"
  // folder while the returned public URL pointed somewhere else.
  for (const [name, value] of [['R2_ENDPOINT', endpoint], ['R2_PUBLIC_URL', publicUrl]] as const) {
    const path = new URL(value).pathname
    if (path !== '' && path !== '/') {
      throw new Error(`${name} must be a bare origin with no path — got "${value}"`)
    }
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })

  return { client, bucket, endpoint, publicUrl, eaBucket }
}

/** Thrown when an upload isn't a well-formed data URI of an allowed image type. */
export class InvalidImageError extends Error {}

// Allowed upload types, detected from the file's leading bytes. The data-URI
// header is client-controlled and never trusted: without this, a
// "data:text/html;base64,..." upload would land in the public bucket and be
// served as HTML from our image origin.
const IMAGE_SIGNATURES: Array<{ type: string; ext: string; matches: (b: Buffer) => boolean }> = [
  { type: 'image/jpeg', ext: 'jpg',  matches: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png',  ext: 'png',  matches: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/webp', ext: 'webp', matches: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { type: 'image/gif',  ext: 'gif',  matches: b => b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6)) },
]

/**
 * Decodes a base64 image data URI and identifies its real type by magic bytes.
 *
 * @throws InvalidImageError if the string isn't a base64 data URI, or the
 *         bytes aren't JPEG, PNG, WebP or GIF
 */
function parseImageDataUri(base64: string): { buffer: Buffer<ArrayBuffer>; contentType: string; ext: string } {
  const commaIdx   = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)   // "data:image/png;base64"

  if (commaIdx === -1 || !headerPart.startsWith('data:') || !headerPart.includes(';base64')) {
    throw new InvalidImageError('Invalid base64 string')
  }

  const buffer = Buffer.from(base64.slice(commaIdx + 1), 'base64')
  const match  = IMAGE_SIGNATURES.find(sig => sig.matches(buffer))
  if (!match) {
    throw new InvalidImageError('Unsupported file type — upload a JPEG, PNG, WebP or GIF')
  }

  return { buffer, contentType: match.type, ext: match.ext }
}

/**
 * Uploads a base64 data URI to Cloudflare R2.
 * Returns the public HTTPS URL of the uploaded file.
 *
 * @param base64    - base64 data URI (e.g. "data:image/png;base64,...")
 * @param folder    - folder inside the bucket (e.g. "covers", "pages")
 * @throws InvalidImageError if the data isn't an allowed image; Error if the PUT to R2 fails
 */
export async function uploadToR2(
  base64: string,
  folder: string
): Promise<string> {
  const { client, bucket, endpoint, publicUrl } = getR2()

  const { buffer, contentType, ext } = parseImageDataUri(base64)
  // Always a fresh UUID key — never a stable name. Stable keys (the old
  // cover-{slug}, site-logo, pages/chapter-{id}-page-{n}) let one row's
  // upload overwrite, or its delete remove, another row's file, and
  // combined with the immutable Cache-Control below they could keep a stale
  // response cached for a year.
  const key = `${folder}/${uuidv4()}.${ext}`

  const signed = await client.sign(`${endpoint}/${bucket}/${key}`, {
    method: 'PUT',
    body: buffer,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // cache for 1 year
    },
  })

  const res = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: buffer,
  })

  // Unlike the AWS SDK's client.send(), plain fetch() does NOT throw on a
  // non-2xx response — a bad request or wrong credentials would otherwise
  // "succeed" silently here, and we'd insert a broken image_url into
  // Supabase that only fails later when a reader loads it.
  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`)
  }

  return `${publicUrl}/${key}`
}

// Public origins the same bucket was served from before R2_PUBLIC_URL moved
// to the custom domain. Rows written before the switch still carry these, and
// without this list deleteFromR2 would skip them as "not an R2 URL" and
// orphan the object. Remove once no stored URL uses them (see the
// 20261003130000_rewrite_r2_public_urls migration and next.config.ts).
const LEGACY_PUBLIC_URLS = ['https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev']

/**
 * Returns the object key for a public URL served from this bucket — via the
 * current R2_PUBLIC_URL or a legacy origin — or null if it isn't one.
 * Strips the "?v=..." cache-busting suffix older uploads carry in their
 * stored URL; the actual R2 object Key never includes it.
 */
function keyFromPublicUrl(url: string, publicUrl: string): string | null {
  for (const origin of [publicUrl, ...LEGACY_PUBLIC_URLS]) {
    // Match on "origin/" so a look-alike host (origin + ".evil.example")
    // can't pass as ours.
    const prefix = `${origin.replace(/\/$/, '')}/`
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length).split('?')[0] || null
    }
  }
  return null
}

/**
 * Deletes a file from Cloudflare R2 by its public URL.
 * Extracts the key from the URL and issues a DELETE.
 *
 * @param url - the full public URL of the file to delete
 * @throws if the DELETE to R2 fails
 */
export async function deleteFromR2(url: string): Promise<void> {
  const { client, bucket, endpoint, publicUrl } = getR2()

  // Skip if not an R2 URL — could be a leftover Cloudinary URL
  const key = keyFromPublicUrl(url, publicUrl)
  if (!key) {
    console.warn('Skipping delete — not an R2 URL:', url)
    return
  }

  const res = await client.fetch(`${endpoint}/${bucket}/${key}`, {
    method: 'DELETE',
  })

  // Same reasoning as uploadToR2 — fetch() won't throw on a failed delete on
  // its own. Note: S3/R2 DELETE is idempotent — deleting a key that's
  // already gone still returns 204, so this only catches real failures
  // (bad auth, wrong bucket), never "already deleted."
  if (!res.ok) {
    throw new Error(`R2 delete failed (${res.status}): ${await res.text()}`)
  }
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Deletes many objects with S3 DeleteObjects — one request per 1000 keys.
 *
 * Use this instead of looping deleteFromR2 for bulk deletes: every
 * deleteFromR2 call is its own fetch(), and the Workers free plan allows
 * only 50 subrequests per request, so a single 40+ page chapter would hit
 * the cap partway through and leave the rest orphaned.
 *
 * Accepts public URLs (public bucket, current or legacy origin) and "ea:"
 * keys (private EA bucket).
 * Anything else (e.g. a leftover Cloudinary URL) is skipped with a warning.
 * Never throws for a failed delete — it returns the refs that weren't
 * removed so the caller can log and report them; it does throw if R2 is
 * misconfigured (via getR2()).
 *
 * @returns failed - refs that could not be deleted
 */
export async function deleteManyFromR2(refs: string[]): Promise<{ failed: string[] }> {
  const { client, bucket, eaBucket, endpoint, publicUrl } = getR2()

  // bucket name → (key → original ref, for reporting)
  const byBucket = new Map<string, Map<string, string>>([[bucket, new Map()], [eaBucket, new Map()]])
  for (const ref of new Set(refs)) {
    if (ref.startsWith('ea:')) {
      byBucket.get(eaBucket)!.set(ref.slice(3), ref)
      continue
    }
    // Same matching as deleteFromR2 — current or legacy origin, "?v=" stripped.
    const key = keyFromPublicUrl(ref, publicUrl)
    if (key) {
      byBucket.get(bucket)!.set(key, ref)
    } else {
      console.warn('Skipping delete — not an R2 URL:', ref)
    }
  }

  const failed: string[] = []

  for (const [bucketName, keys] of byBucket) {
    const entries = [...keys.entries()]
    for (let i = 0; i < entries.length; i += 1000) {
      const chunk = entries.slice(i, i + 1000)
      const body =
        '<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>' +
        chunk.map(([key]) => `<Object><Key>${xmlEscape(key)}</Key></Object>`).join('') +
        '</Delete>'

      try {
        const res = await client.fetch(`${endpoint}/${bucketName}?delete`, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/xml',
            'Content-MD5':  createHash('md5').update(body).digest('base64'),
          },
        })
        const xml = await res.text()

        // Same as deleteFromR2 — fetch() doesn't throw on a non-2xx.
        if (!res.ok) {
          console.error(`R2 DeleteObjects failed (${res.status}) on ${bucketName}:`, xml)
          failed.push(...chunk.map(([, ref]) => ref))
          continue
        }

        // A 200 can still carry per-key <Error> entries (Quiet mode lists
        // only failures). Deleting a missing key is NOT an error.
        for (const m of xml.matchAll(/<Error>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Error>/g)) {
          const ref = keys.get(m[1] ?? '')
          console.error('R2 DeleteObjects per-key error:', m[0])
          failed.push(ref ?? m[1] ?? '')
        }
      } catch (err) {
        console.error(`R2 DeleteObjects request failed on ${bucketName}:`, err)
        failed.push(...chunk.map(([, ref]) => ref))
      }
    }
  }

  return { failed }
}

/**
 * Extracts the R2 key from a public URL.
 * Used when we need the key for other operations.
 */
export function extractR2Key(url: string): string {
  const { publicUrl } = getR2()
  return keyFromPublicUrl(url, publicUrl) ?? ''
}

/** One object in the public bucket, as ListObjectsV2 reports it. */
export type R2ObjectInfo = { key: string; size: number; lastModified: Date }

const xmlUnescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/**
 * Lists every object in the public bucket (not the EA bucket).
 * Paginates through ListObjectsV2, 1000 keys per request.
 *
 * aws4fetch is a thin fetch() wrapper, so ListObjectsV2 hands back the raw
 * S3 XML; we pull out the few fields we need with regex rather than pulling
 * in an XML parser for a response we fully control (Cloudflare's own
 * well-formed XML, never user input).
 *
 * @throws if any page of the listing fails; never returns a partial list,
 *   because callers (the unused-files cleanup) must not act on one
 */
export async function listR2Objects(): Promise<R2ObjectInfo[]> {
  const { client, bucket, endpoint } = getR2()

  const objects: R2ObjectInfo[] = []
  let continuationToken: string | undefined = undefined

  do {
    const url = new URL(`${endpoint}/${bucket}`)
    url.searchParams.set('list-type', '2')
    if (continuationToken) {
      url.searchParams.set('continuation-token', continuationToken)
    }

    const res = await client.fetch(url.toString())
    if (!res.ok) {
      throw new Error(`R2 list failed (${res.status}): ${await res.text()}`)
    }
    const xml = await res.text()

    for (const [, block = ''] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key  = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1]
      const size = block.match(/<Size>(\d+)<\/Size>/)?.[1]
      const date = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1]
      if (key === undefined || size === undefined || date === undefined) {
        throw new Error('R2 list: unexpected <Contents> entry')
      }
      objects.push({ key: xmlUnescape(key), size: Number(size), lastModified: new Date(date) })
    }

    const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    const tokenMatch  = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)
    continuationToken = isTruncated ? tokenMatch?.[1] : undefined
    if (isTruncated && !continuationToken) {
      throw new Error('R2 list: truncated response without a continuation token')
    }
  } while (continuationToken)

  return objects
}

/**
 * Public-bucket keys for many stored refs at once (current or legacy origin).
 * EA refs ("ea:...") and non-R2 URLs have no key here and are left out.
 * Reads the config once, unlike calling extractR2Key per ref, which matters
 * for thousands of page URLs under the Workers CPU limit.
 */
export function publicKeysFromRefs(refs: string[]): Set<string> {
  const { publicUrl } = getR2()
  const keys = new Set<string>()
  for (const ref of refs) {
    const key = keyFromPublicUrl(ref, publicUrl)
    if (key) keys.add(key)
  }
  return keys
}

/** Returns total storage used in the public R2 bucket, in bytes. */
export async function getR2StorageBytes(): Promise<number> {
  const objects = await listR2Objects()
  return objects.reduce((sum, o) => sum + o.size, 0)
}

/**
 * Deletes objects in the public bucket by key (not URL). Same batching and
 * failure reporting as deleteManyFromR2.
 * @returns failed - the keys that could not be deleted
 */
export async function deleteR2Keys(keys: string[]): Promise<{ failed: string[] }> {
  const { publicUrl } = getR2()
  const base = publicUrl.replace(/\/$/, '')
  const { failed } = await deleteManyFromR2(keys.map(k => `${base}/${k}`))
  return { failed: failed.map(ref => ref.slice(base.length + 1)) }
}

// ─────────────────────────────────────────────────────────────────────────
// Early Access bucket — private, no public domain attached.
// Pages uploaded here are only ever reachable through a presigned URL
// issued by an entitlement-checked API route, never a direct link.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Uploads a base64 data URI to the PRIVATE Early Access bucket.
 * Unlike uploadToR2, this returns a bare R2 key (there is no public URL for
 * this bucket) prefixed with "ea:" so callers can tell at a glance that a
 * stored image_url needs the presigned-URL route, not a direct <img> src.
 *
 * @param base64    - base64 data URI (e.g. "data:image/png;base64,...")
 * @param folder    - folder inside the EA bucket (e.g. "pages")
 * @param filename  - optional stable filename; if omitted, generates a UUID
 * @returns          - a string like "ea:pages/uuid.webp", NOT a URL
 * @throws InvalidImageError if the data isn't an allowed image; Error if the PUT to R2 fails
 */
export async function uploadToEAR2(
  base64: string,
  folder: string,
  filename?: string
): Promise<string> {
  const { client, eaBucket, endpoint } = getR2()

  const { buffer, contentType, ext } = parseImageDataUri(base64)
  const key = `${folder}/${filename ?? uuidv4()}.${ext}`

  const signed = await client.sign(`${endpoint}/${eaBucket}/${key}`, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': contentType },
    // No Cache-Control here — these aren't meant to be cached publicly.
  })

  const res = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: buffer,
  })

  if (!res.ok) {
    throw new Error(`EA R2 upload failed (${res.status}): ${await res.text()}`)
  }

  return `ea:${key}`
}

/**
 * Generates a short-lived, signed URL for a private EA object.
 * Call this ONLY after an entitlement check has already passed — this
 * function itself does no authorization, it just signs whatever key it's
 * given.
 *
 * @param eaImageUrl   - the "ea:folder/file.webp" string stored in image_url
 * @param expiresInSeconds - how long the URL stays valid (default 5 minutes)
 */
export async function getEASignedUrl(
  eaImageUrl: string,
  expiresInSeconds = 300
): Promise<string> {
  const { client, eaBucket, endpoint } = getR2()

  if (!eaImageUrl.startsWith('ea:')) {
    throw new Error(`Not an EA image_url: ${eaImageUrl}`)
  }
  const key = eaImageUrl.slice(3) // strip the "ea:" prefix

  // client.sign() with signQuery:true embeds the credentials + signature in
  // the URL's query string instead of headers — that's what makes it
  // shareable as a plain link rather than something only our own server can
  // present. X-Amz-Expires has to be on the URL BEFORE signing (it's part
  // of what gets signed), not appended after.
  const signed = await client.sign(
    `${endpoint}/${eaBucket}/${key}?X-Amz-Expires=${expiresInSeconds}`,
    { method: 'GET', aws: { signQuery: true } }
  )

  return signed.url.toString()
}

/**
 * Deletes an object from the private EA bucket.
 *
 * @param eaImageUrl - the "ea:folder/file.webp" string stored in image_url
 */
export async function deleteFromEAR2(eaImageUrl: string): Promise<void> {
  const { client, eaBucket, endpoint } = getR2()

  if (!eaImageUrl.startsWith('ea:')) {
    console.warn('Skipping EA delete — not an ea: key:', eaImageUrl)
    return
  }
  const key = eaImageUrl.slice(3)

  const res = await client.fetch(`${endpoint}/${eaBucket}/${key}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    throw new Error(`EA R2 delete failed (${res.status}): ${await res.text()}`)
  }
}