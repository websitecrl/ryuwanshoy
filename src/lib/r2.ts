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

/**
 * Uploads a base64 data URI to Cloudflare R2.
 * Returns the public HTTPS URL of the uploaded file.
 *
 * @param base64    - base64 data URI (e.g. "data:image/png;base64,...")
 * @param folder    - folder inside the bucket (e.g. "covers", "pages")
 * @param filename  - optional stable filename; if omitted, generates a UUID
 * @throws if the base64 string is malformed, or the PUT to R2 fails
 */
export async function uploadToR2(
  base64: string,
  folder: string,
  filename?: string
): Promise<string> {
  const { client, bucket, endpoint, publicUrl } = getR2()

  const commaIdx = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)   // "data:image/png;base64"
  const data       = base64.slice(commaIdx + 1)   // everything after the comma

  if (commaIdx === -1 || !headerPart.startsWith('data:') || !headerPart.includes(';base64')) {
    throw new Error('Invalid base64 string')
  }

  const contentType = headerPart.slice(5, headerPart.indexOf(';')) // between "data:" and ";"
  const buffer      = Buffer.from(data, 'base64')

  const ext = contentType.split('/')[1] ?? 'jpg'
  const key = `${folder}/${filename ?? uuidv4()}.${ext}`

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

  // Callers that pass a fixed `filename` (site logo, series covers, chapter
  // pages) reuse the exact same key on every re-upload. Combined with the
  // "immutable" Cache-Control above, that means the FIRST response any
  // browser or CDN ever saw for that URL — a 404, if the upload happened to
  // fail or land in the wrong place that one time — can get cached for a
  // year and keep being served even after a later upload succeeds, because
  // the URL string never changed. A `?v=` query string doesn't affect which
  // R2 object gets served (the Key above has no query string in it), but it
  // does make every upload return a distinct URL, so a stale cached response
  // for the old URL is never in the way of the new one.
  return `${publicUrl}/${key}?v=${Date.now()}`
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
 * Strips the "?v=..." cache-busting suffix uploadToR2 appends; the actual R2
 * object Key never includes it, only the returned URL does.
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
 * Accepts public URLs (public bucket) and "ea:" keys (private EA bucket).
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
    } else if (ref.startsWith(`${publicUrl}/`)) {
      // Strip the "?v=..." cache-busting suffix uploadToR2 appends.
      const key = ref.slice(publicUrl.length + 1).split('?')[0]
      if (key) byBucket.get(bucket)!.set(key, ref)
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

/**
 * Returns total storage used in the R2 bucket in bytes.
 * Paginates through ListObjectsV2 and sums every object's size.
 *
 * With the old AWS SDK this came back as an already-parsed JS object.
 * aws4fetch is a thin fetch() wrapper, so ListObjectsV2 hands back the raw
 * S3 XML response body instead — we pull out just the three fields we need
 * (<Size>, <IsTruncated>, <NextContinuationToken>) with regex rather than
 * pulling in a full XML parser for three fields from a response we fully
 * control (it's always Cloudflare's own well-formed XML, never user input).
 */
export async function getR2StorageBytes(): Promise<number> {
  const { client, bucket, endpoint } = getR2()

  let totalBytes = 0
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

    for (const match of xml.matchAll(/<Size>(\d+)<\/Size>/g)) {
      totalBytes += Number(match[1])
    }

    const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    const tokenMatch  = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)
    continuationToken = isTruncated ? tokenMatch?.[1] : undefined
  } while (continuationToken)

  return totalBytes
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
 * @throws if the base64 string is malformed, or the PUT to R2 fails
 */
export async function uploadToEAR2(
  base64: string,
  folder: string,
  filename?: string
): Promise<string> {
  const { client, eaBucket, endpoint } = getR2()

  const commaIdx = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)
  const data       = base64.slice(commaIdx + 1)

  if (commaIdx === -1 || !headerPart.startsWith('data:') || !headerPart.includes(';base64')) {
    throw new Error('Invalid base64 string')
  }

  const contentType = headerPart.slice(5, headerPart.indexOf(';'))
  const buffer       = Buffer.from(data, 'base64')
  const ext          = contentType.split('/')[1] ?? 'jpg'
  const key          = `${folder}/${filename ?? uuidv4()}.${ext}`

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