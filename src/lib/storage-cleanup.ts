import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteR2Keys, listR2Objects, publicKeysFromRefs } from '@/lib/r2'

// Finds public-bucket files no row points at. Deleting a used file breaks the site, so every rule errs on keeping.

/** Folders uploadToR2 writes to. Anything outside them was put there by hand and is never touched. */
const MANAGED_PREFIXES = ['covers/', 'pages/', 'posts/', 'hero-banners/', 'settings/']

/** New files are skipped: an upload lands in R2 just before its row is inserted. */
const MIN_AGE_MS = 24 * 60 * 60 * 1000

// PostgREST caps rows per request, so columns are read in pages.
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

/** Reads one image column from every row, page by page. Throws on any error (never a partial list). */
async function readColumn(
  table: 'series' | 'pages' | 'posts' | 'hero_slides' | 'settings',
  column: string
): Promise<string[]> {
  const values: string[] = []
  // Stop only on an empty page, in case max-rows is set below PAGE_SIZE.
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

/** Every public-bucket key the database points at. */
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

/** Unused files in managed folders, older than MIN_AGE_MS, biggest first. Throws instead of returning a partial result. */
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

/** Deletes only the confirmed keys a fresh scan still reports as unused. */
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
