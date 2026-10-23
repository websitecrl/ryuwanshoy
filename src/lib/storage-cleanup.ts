import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteR2Keys, listR2Objects, publicKeysFromRefs } from '@/lib/r2'

// unused public files. deleting a used one breaks the site -> every rule keeps when unsure

/** uploadToR2 folders; anything else is never touched */
const MANAGED_PREFIXES = ['covers/', 'pages/', 'posts/', 'hero-banners/', 'settings/']

/** upload lands before its row -> skip new files */
const MIN_AGE_MS = 24 * 60 * 60 * 1000

// PostgREST row cap -> read in pages
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

/** column -> every row, paged; error -> throw */
async function readColumn(
  table: 'series' | 'pages' | 'posts' | 'hero_slides' | 'settings',
  column: string
): Promise<string[]> {
  const values: string[] = []
  // stop on an empty page (max-rows may be lower)
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

/** DB refs -> public keys */
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

/** list R2 -> managed + old enough + unreferenced -> biggest first */
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

/** confirmed keys -> rescan -> delete still-unused */
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
