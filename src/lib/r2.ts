import 'server-only'
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// R2 is S3-compatible — we use the AWS SDK with Cloudflare's endpoint.
//
// IMPORTANT: env vars are read INSIDE this function, not as top-level module
// constants. On edge runtimes (Cloudflare Pages), module-scope env reads can
// be undefined at build/cold-start time, producing silent failures. Every
// exported function below calls this at the start instead of relying on a
// module-level singleton. See the ryu-r2-upload skill.

/**
 * Builds the R2 client + the raw config values every upload/delete call needs.
 *
 * Validates required vars instead of using `!` non-null assertions — a
 * missing or malformed value here (e.g. R2_ENDPOINT accidentally carrying a
 * bucket-name suffix, or a stale R2_PUBLIC_URL after a bucket rename) used to
 * fail silently: the SDK would still "succeed" but read/write the wrong
 * location. Now it throws immediately with the actual (non-secret) values,
 * so a misconfigured deploy shows up in the logs on the very first request
 * instead of as a mysterious 404 downstream.
 *
 * @throws if any required var is missing/blank, or if R2_ENDPOINT/R2_PUBLIC_URL
 *         carry a path segment (they must be bare origins — no trailing bucket name)
 */
function getR2() {
  const bucket     = process.env.R2_BUCKET_NAME ?? ''
  const endpoint   = process.env.R2_ENDPOINT ?? ''
  const publicUrl  = process.env.R2_PUBLIC_URL ?? ''
  const eaBucket   = process.env.R2_EA_BUCKET_NAME ?? ''
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''

  const missing = Object.entries({ bucket, endpoint, publicUrl, eaBucket, accessKeyId, secretAccessKey })
    .filter(([, v]) => v.trim() === '')
    .map(([k]) => k)

  if (missing.length) {
    throw new Error(`R2 misconfigured — missing env var(s): ${missing.join(', ')}`)
  }

  // endpoint/publicUrl must be bare origins. A bucket name (or anything else)
  // tacked onto the path here gets silently prepended to every object key by
  // the AWS SDK — the exact bug that caused covers to land under an extra
  // "<bucket>/" folder while the returned public URL pointed somewhere else.
  for (const [name, value] of [['R2_ENDPOINT', endpoint], ['R2_PUBLIC_URL', publicUrl]] as const) {
    const path = new URL(value).pathname
    if (path !== '' && path !== '/') {
      throw new Error(`${name} must be a bare origin with no path — got "${value}"`)
    }
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })

  return { client, bucket, publicUrl, eaBucket }
}

/**
 * Uploads a base64 data URI to Cloudflare R2.
 * Returns the public HTTPS URL of the uploaded file.
 *
 * @param base64    - base64 data URI (e.g. "data:image/png;base64,...")
 * @param folder    - folder inside the bucket (e.g. "covers", "pages")
 * @param filename  - optional stable filename; if omitted, generates a UUID
 */
export async function uploadToR2(
  base64: string,
  folder: string,
  filename?: string
): Promise<string> {
  const { client, bucket, publicUrl } = getR2()

  const commaIdx = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)   // "data:image/png;base64"
  const data       = base64.slice(commaIdx + 1)   // everything after the comma

  if (commaIdx === -1 || !headerPart.startsWith('data:') || !headerPart.includes(';base64')) {
    throw new Error('Invalid base64 string')
  }

  const contentType = headerPart.slice(5, headerPart.indexOf(';')) // between "data:" and ";"
  const buffer      = Buffer.from(data, 'base64')

  // Get file extension from content type
  const ext = contentType.split('/')[1] ?? 'jpg'

  // Use provided filename or generate a UUID
  const key = `${folder}/${filename ?? uuidv4()}.${ext}`

  await client.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // cache for 1 year
  }))

  // Return the public URL
  return `${publicUrl}/${key}`
}

/**
 * Deletes a file from Cloudflare R2 by its public URL.
 * Extracts the key from the URL and calls DeleteObject.
 *
 * @param url - the full public URL of the file to delete
 */
export async function deleteFromR2(url: string): Promise<void> {
  const { client, bucket, publicUrl } = getR2()

  // Skip if not an R2 URL — could be a leftover Cloudinary URL
  if (!url.startsWith(publicUrl)) {
    console.warn('Skipping delete — not an R2 URL:', url)
    return
  }

  const key = url.replace(`${publicUrl}/`, '')

  if (!key || key === url) {
    throw new Error(`Could not extract key from URL: ${url}`)
  }

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key:    key,
  }))
}

/**
 * Extracts the R2 key from a public URL.
 * Used when we need the key for other operations.
 */
export function extractR2Key(url: string): string {
  const { publicUrl } = getR2()
  return url.replace(`${publicUrl}/`, '')
}


/**
 * Returns total storage used in the R2 bucket in bytes.
 * paginate through all objects and sum of their sizes.
 */
export async function getR2StorageBytes(): Promise<number> {
  const { client, bucket } = getR2()

  let totalBytes = 0
  let continuationToken: string | undefined = undefined

  do {
    const res: ListObjectsV2CommandOutput = await client.send(new ListObjectsV2Command({
      Bucket:   bucket,
      ContinuationToken: continuationToken,
    }))

    for (const obj of res.Contents ?? []) {
      totalBytes += obj.Size ?? 0
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
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
 */
export async function uploadToEAR2(
  base64: string,
  folder: string,
  filename?: string
): Promise<string> {
  const { client, eaBucket } = getR2()

  const commaIdx = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)
  const data       = base64.slice(commaIdx + 1)

  if (commaIdx === -1 || !headerPart.startsWith('data:') || !headerPart.includes(';base64')) {
    throw new Error('Invalid base64 string')
  }

  const contentType = headerPart.slice(5, headerPart.indexOf(';'))
  const buffer      = Buffer.from(data, 'base64')
  const ext         = contentType.split('/')[1] ?? 'jpg'
  const key         = `${folder}/${filename ?? uuidv4()}.${ext}`

  await client.send(new PutObjectCommand({
    Bucket:      eaBucket,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    // No CacheControl here — these aren't meant to be cached publicly.
  }))

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
  const { client, eaBucket } = getR2()

  if (!eaImageUrl.startsWith('ea:')) {
    throw new Error(`Not an EA image_url: ${eaImageUrl}`)
  }
  const key = eaImageUrl.slice(3) // strip the "ea:" prefix

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: eaBucket, Key: key }),
    { expiresIn: expiresInSeconds }
  )
}

/**
 * Deletes an object from the private EA bucket.
 *
 * @param eaImageUrl - the "ea:folder/file.webp" string stored in image_url
 */
export async function deleteFromEAR2(eaImageUrl: string): Promise<void> {
  const { client, eaBucket } = getR2()

  if (!eaImageUrl.startsWith('ea:')) {
    console.warn('Skipping EA delete — not an ea: key:', eaImageUrl)
    return
  }
  const key = eaImageUrl.slice(3)

  await client.send(new DeleteObjectCommand({
    Bucket: eaBucket,
    Key:    key,
  }))
}