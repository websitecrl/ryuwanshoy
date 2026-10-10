import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteR2Keys, listR2Objects, publicKeysFromRefs } from '@/lib/r2'

// Finds files in the public R2 bucket that no database row points at, so the
// admin can remove them from Settings instead of opening the R2 dashboard.
// Deleting the wrong file breaks the site (a missing chapter page), so every
// rule below errs on the side of keeping a file.

/** Folders uploadToR2 writes to. Anything outside them was put there by hand and is never touched. */
const MANAGED_PREFIXES = ['covers/', 'pages/', 'posts/', 'hero-banners/', 'settings/']

/**
 * Files younger than this are never reported. An upload lands in R2 a moment
 * before its row is inserted (and a failed insert cleans up after itself), so
 * a brand new file without a row is normal, not unused.
 */
const MIN_AGE_MS = 24 * 60 * 60 * 1000

// PostgREST returns at most 1000 rows per request by default. Reading only
// the first page would make every later page look unused, so every column is
// read in pages of this size until a short page comes back.
const PAGE_SIZE = 1000

export type UnusedFile = { key: string; size: number; lastModified: string }

export type UnusedScan = {
  files: UnusedFile[]
  totalBytes: number
  /** Objects in the bucket, for the summary line. */
  scannedCount: number
  /** Distinct R2 files the database points at. */
  usedCount: number
}

/**
 * Reads one image column from every row of a table, page by page.
 * @throws on any Supabase error: a partial read must never produce a delete list
 */
async function readColumn(
  table: 'series' | 'pages' | 'posts' | 'hero_slides' | 'settings',
  column: string
): Promise<string[]> {
  const values: string[] = []
  // Advance by the rows actually returned and stop only on an empty page:
  // if the project's max-rows were set below PAGE_SIZE, "stop on a short
  // page" would end after the first page and miss rows.
  for (let from = 0; ; ) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(`id, ${column}`)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
    if (rows.length === 0) return values
    for (const row of rows) {
      const value = row[column]
      if (typeof value === 'string' && value) values.push(value)
    }
    from += rows.length
  }
}

/**
 * Every public-bucket key the database points at. EA refs ("ea:...") and
 * non-R2 URLs map to no key and are ignored: they can't be in this bucket.
 */
async function getUsedKeys(): Promise<Set<string>> {
  const columns = await Promise.all([
    readColumn('series', 'cover_image'),
    readColumn('series', 'banner_image'),
    readColumn('pages', 'image_url'),
    readColumn('posts', 'image_url'),
    readColumn('hero_slides', 'banner_image'),
    readColumn('settings', 'logo_url'),
  ])
  return publicKeysFromRefs(columns.flat())
}

/**
 * Lists files in the public bucket that nothing uses: inside a managed
 * folder, at least MIN_AGE_MS old, and not referenced by any row.
 *
 * @param now - injected for testability
 * @returns unused files, biggest first, plus counts for the summary
 * @throws if the R2 listing or any database read fails (never a partial result)
 */
export async function findUnusedFiles(now = new Date()): Promise<UnusedScan> {
  const [objects, used] = await Promise.all([listR2Objects(), getUsedKeys()])
  const cutoff = now.getTime() - MIN_AGE_MS

  const files = objects
    .filter(o => MANAGED_PREFIXES.some(p => o.key.startsWith(p)))
    .filter(o => o.lastModified.getTime() <= cutoff)
    .filter(o => !used.has(o.key))
    .sort((a, b) => b.size - a.size)
    .map(o => ({ key: o.key, size: o.size, lastModified: o.lastModified.toISOString() }))

  return {
    files,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
    scannedCount: objects.length,
    usedCount: used.size,
  }
}

/**
 * Deletes the requested files, but only those a fresh scan still reports as
 * unused. The list the admin confirmed may be minutes old; a file that has
 * since been attached to a row, or that isn't eligible at all, is skipped.
 *
 * @param keys - keys the admin confirmed, from a previous findUnusedFiles
 * @returns what was deleted, what failed, and keys skipped as no longer unused
 */
export async function deleteUnusedFiles(keys: string[]): Promise<{
  deleted: string[]
  failed: string[]
  skipped: string[]
  freedBytes: number
}> {
  const { files } = await findUnusedFiles()
  const stillUnused = new Map(files.map(f => [f.key, f.size]))

  const requested = [...new Set(keys)]
  const toDelete  = requested.filter(k => stillUnused.has(k))
  const skipped   = requested.filter(k => !stillUnused.has(k))
  if (!toDelete.length) return { deleted: [], failed: [], skipped, freedBytes: 0 }

  const { failed } = await deleteR2Keys(toDelete)
  const failedSet = new Set(failed)
  const deleted   = toDelete.filter(k => !failedSet.has(k))

  return {
    deleted,
    failed,
    skipped,
    freedBytes: deleted.reduce((sum, k) => sum + (stillUnused.get(k) ?? 0), 0),
  }
}
