import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

// R2 is S3-compatible — we use the AWS SDK with Cloudflare's endpoint
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

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

  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // cache for 1 year
  }))

  // Return the public URL
  return `${PUBLIC_URL}/${key}`
}

/**
 * Deletes a file from Cloudflare R2 by its public URL.
 * Extracts the key from the URL and calls DeleteObject.
 *
 * @param url - the full public URL of the file to delete
 */
export async function deleteFromR2(url: string): Promise<void> {
  // Skip if not an R2 URL — could be a leftover Cloudinary URL
  if (!url.startsWith(PUBLIC_URL)) {
    console.warn('Skipping delete — not an R2 URL:', url)
    return
  }

  const key = url.replace(`${PUBLIC_URL}/`, '')

  if (!key || key === url) {
    throw new Error(`Could not extract key from URL: ${url}`)
  }

  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key:    key,
  }))
}
/**
 * Extracts the R2 key from a public URL.
 * Used when we need the key for other operations.
 */
export function extractR2Key(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, '')
}


/**
 * Returns total storage used in the R2 bucket in bytes.
 * paginate through all objects and sum of their sizes.
 */
export async function  getR2StorageBytes(): Promise<number>  {
  let totalBytes = 0
  let continuationToken: string | undefined = undefined

  do {
    const res: ListObjectsV2CommandOutput = await r2.send(new ListObjectsV2Command({
      Bucket:   BUCKET, 
      ContinuationToken: continuationToken,
    }))

    for (const obj of res.Contents ?? []) {
      totalBytes += obj.Size ?? 0
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

    return totalBytes


}