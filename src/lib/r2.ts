import 'server-only'
import { AwsClient } from 'aws4fetch'
import { createHash } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'

// aws4fetch (AWS SDK blew the 10ms CPU limit). fetch: check res.ok yourself; lists: raw XML

/** env -> R2 client + config. missing var or URL with a path -> throw */
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

  // a path here would prefix every key
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

// type from magic bytes (the data URI header is client-controlled)
const IMAGE_SIGNATURES: Array<{ type: string; ext: string; matches: (b: Buffer) => boolean }> = [
  { type: 'image/jpeg', ext: 'jpg',  matches: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png',  ext: 'png',  matches: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/webp', ext: 'webp', matches: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { type: 'image/gif',  ext: 'gif',  matches: b => b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6)) },
]

/** data URI -> bytes -> real type (JPEG, PNG, WebP, GIF) else InvalidImageError */
function parseImageDataUri(base64: string): { buffer: Buffer<ArrayBuffer>; contentType: string; ext: string } {
  const commaIdx   = base64.indexOf(',')
  const headerPart = base64.slice(0, commaIdx)

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

/** data URI -> fresh key -> PUT -> public URL */
export async function uploadToR2(
  base64: string,
  folder: string
): Promise<string> {
  const { client, bucket, endpoint, publicUrl } = getR2()

  const { buffer, contentType, ext } = parseImageDataUri(base64)
  // fresh key every time (stable keys overwrote other rows' files)
  const key = `${folder}/${uuidv4()}.${ext}`

  const signed = await client.sign(`${endpoint}/${bucket}/${key}`, {
    method: 'PUT',
    body: buffer,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })

  const res = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: buffer,
  })

  // non-2xx -> throw
  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`)
  }

  return `${publicUrl}/${key}`
}

// old r2.dev origin in older rows
const LEGACY_PUBLIC_URLS = ['https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev']

/** URL on this bucket -> key ("?v=" stripped), else null */
function keyFromPublicUrl(url: string, publicUrl: string): string | null {
  for (const origin of [publicUrl, ...LEGACY_PUBLIC_URLS]) {
    // "origin/" -> look-alike hosts don't match
    const prefix = `${origin.replace(/\/$/, '')}/`
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length).split('?')[0] || null
    }
  }
  return null
}

/** URL -> key -> DELETE (non-R2 URLs skipped) */
export async function deleteFromR2(url: string): Promise<void> {
  const { client, bucket, endpoint, publicUrl } = getR2()

  const key = keyFromPublicUrl(url, publicUrl)
  if (!key) {
    console.warn('Skipping delete — not an R2 URL:', url)
    return
  }

  const res = await client.fetch(`${endpoint}/${bucket}/${key}`, {
    method: 'DELETE',
  })

  // missing key = 204, so only real failures land here
  if (!res.ok) {
    throw new Error(`R2 delete failed (${res.status}): ${await res.text()}`)
  }
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** refs -> group by bucket -> DeleteObjects per 1000 keys -> { failed } (never throws per file) */
export async function deleteManyFromR2(refs: string[]): Promise<{ failed: string[] }> {
  const { client, bucket, eaBucket, endpoint, publicUrl } = getR2()

  // bucket -> key -> original ref
  const byBucket = new Map<string, Map<string, string>>([[bucket, new Map()], [eaBucket, new Map()]])
  for (const ref of new Set(refs)) {
    if (ref.startsWith('ea:')) {
      byBucket.get(eaBucket)!.set(ref.slice(3), ref)
      continue
    }
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

        if (!res.ok) {
          console.error(`R2 DeleteObjects failed (${res.status}) on ${bucketName}:`, xml)
          failed.push(...chunk.map(([, ref]) => ref))
          continue
        }

        // 200 can still list per-key errors
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

/** public URL -> key */
export function extractR2Key(url: string): string {
  const { publicUrl } = getR2()
  return keyFromPublicUrl(url, publicUrl) ?? ''
}

/** One object in the public bucket, as ListObjectsV2 reports it. */
export type R2ObjectInfo = { key: string; size: number; lastModified: Date }

const xmlUnescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** every public object; failed page -> throw (no partial list) */
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

/** refs -> public keys (config read once) */
export function publicKeysFromRefs(refs: string[]): Set<string> {
  const { publicUrl } = getR2()
  const keys = new Set<string>()
  for (const ref of refs) {
    const key = keyFromPublicUrl(ref, publicUrl)
    if (key) keys.add(key)
  }
  return keys
}

/** public bucket size in bytes */
export async function getR2StorageBytes(): Promise<number> {
  const objects = await listR2Objects()
  return objects.reduce((sum, o) => sum + o.size, 0)
}

/** keys -> batched delete -> { failed } */
export async function deleteR2Keys(keys: string[]): Promise<{ failed: string[] }> {
  const { publicUrl } = getR2()
  const base = publicUrl.replace(/\/$/, '')
  const { failed } = await deleteManyFromR2(keys.map(k => `${base}/${k}`))
  return { failed: failed.map(ref => ref.slice(base.length + 1)) }
}

// EA bucket: private -> presigned URLs only

/** data URI -> private bucket -> "ea:folder/file" key */
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

/** "ea:" key -> signed URL. no auth check: call after entitlement */
export async function getEASignedUrl(
  eaImageUrl: string,
  expiresInSeconds = 300
): Promise<string> {
  const { client, eaBucket, endpoint } = getR2()

  if (!eaImageUrl.startsWith('ea:')) {
    throw new Error(`Not an EA image_url: ${eaImageUrl}`)
  }
  const key = eaImageUrl.slice(3)

  // X-Amz-Expires -> URL -> sign (signature in the query)
  const signed = await client.sign(
    `${endpoint}/${eaBucket}/${key}?X-Amz-Expires=${expiresInSeconds}`,
    { method: 'GET', aws: { signQuery: true } }
  )

  return signed.url.toString()
}

/** Deletes an object from the private EA bucket. */
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