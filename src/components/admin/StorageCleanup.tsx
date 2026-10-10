'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Search } from 'lucide-react'
import DeleteButton from '@/components/admin/DeleteButton'
import { formatBytes } from '@/lib/format'

type UnusedFile = { key: string; size: number; lastModified: string }
type Scan = { files: UnusedFile[]; totalBytes: number; scannedCount: number; usedCount: number }

// Fired after a cleanup so the Sidebar storage chip refreshes its number.
export const STORAGE_UPDATED_EVENT = 'storage-updated'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Settings → Storage: finds files in the public R2 bucket that nothing on the
 * site uses (left behind by old deletes) and removes them, so the admin never
 * has to open the R2 dashboard. Read only until the confirm dialog's Delete.
 */
export default function StorageCleanup() {
  const [scan, setScan]         = useState<Scan | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [result, setResult]     = useState<string | null>(null)

  async function check() {
    setChecking(true)
    setError(null)
    setResult(null)
    try {
      const res  = await fetch('/api/storage/unused', { cache: 'no-store' })
      const json = await res.json().catch(() => null) as (Scan & { error?: string }) | null
      if (!res.ok || !json || json.error) throw new Error(json?.error ?? 'Could not check storage.')
      setScan(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check storage.')
    } finally {
      setChecking(false)
    }
  }

  // Throws on failure so DeleteButton keeps its dialog open with the message.
  async function deleteAll() {
    if (!scan) return
    const res  = await fetch('/api/storage/unused', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: scan.files.map(f => f.key) }),
    })
    const json = await res.json().catch(() => null) as
      { deleted: string[]; failed: string[]; skipped: string[]; freedBytes: number; error?: string } | null
    if (!res.ok || !json || json.error) throw new Error(json?.error ?? 'Could not delete files.')

    const parts = [`Deleted ${json.deleted.length} file${json.deleted.length === 1 ? '' : 's'}, freed ${formatBytes(json.freedBytes)}.`]
    if (json.skipped.length) parts.push(`${json.skipped.length} kept because they're in use again.`)
    if (json.failed.length)  parts.push(`${json.failed.length} couldn't be deleted; check again to retry.`)
    setResult(parts.join(' '))
    setScan(null)
    window.dispatchEvent(new Event(STORAGE_UPDATED_EVENT))
  }

  const count = scan?.files.length ?? 0

  return (
    <div className="rounded-xl border p-6 bg-[var(--ryu-surface-1)] border-[var(--ryu-border)]">
      <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1 text-[var(--ryu-primary-deep)]">Storage</div>
      <div className="font-heading font-semibold mb-1 text-[22px] tracking-[-0.3px] text-[var(--ryu-text)]">Unused files</div>
      <p className="text-[13px] mb-5 text-[var(--ryu-text-2)]">
        Images left in Cloudflare R2 that nothing on the site uses anymore. Files from the last 24 hours
        are never included, so an upload in progress is safe.
      </p>

      <button
        onClick={check}
        disabled={checking}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13.5px] font-semibold transition-colors
                   border-[var(--ryu-border)] bg-[var(--ryu-surface-2)] text-[var(--ryu-text)]
                   hover:border-[var(--ryu-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {checking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        {checking ? 'Checking…' : scan ? 'Check again' : 'Check for unused files'}
      </button>

      {error && <p role="alert" className="mt-4 text-[13px] font-semibold text-[var(--ryu-danger)]">{error}</p>}

      {result && (
        <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[var(--ryu-text)]">
          <CheckCircle2 size={14} className="text-[var(--ryu-primary-deep)]" /> {result}
        </p>
      )}

      {scan && count === 0 && (
        <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[var(--ryu-text)]">
          <CheckCircle2 size={14} className="text-[var(--ryu-primary-deep)]" />
          No unused files. Storage is clean ({scan.scannedCount} file{scan.scannedCount === 1 ? '' : 's'} checked).
        </p>
      )}

      {scan && count > 0 && (
        <div className="mt-5">
          <div className="text-[13.5px] font-semibold mb-2 text-[var(--ryu-text)]">
            Found {count} unused file{count === 1 ? '' : 's'} · {formatBytes(scan.totalBytes)}
            <span className="font-normal text-[var(--ryu-text-2)]">
              {' '}({scan.scannedCount} checked, {scan.usedCount} in use)
            </span>
          </div>

          <ul className="max-h-64 overflow-y-auto rounded-lg border divide-y border-[var(--ryu-border)] divide-[var(--ryu-border-soft)]">
            {scan.files.map(f => (
              <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <span className="font-mono-ryu truncate flex-1 text-[var(--ryu-text)]" title={f.key}>{f.key}</span>
                <span className="shrink-0 text-[var(--ryu-text-2)]">{formatBytes(f.size)}</span>
                <span className="shrink-0 w-24 text-right text-[var(--ryu-text-3)]">{dateFmt.format(new Date(f.lastModified))}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <DeleteButton
              variant="pill"
              label={`Delete ${count} unused file${count === 1 ? '' : 's'} (${formatBytes(scan.totalBytes)})`}
              title={`Delete ${count} unused file${count === 1 ? '' : 's'}?`}
              description="These images aren't used anywhere on the site. They're removed from Cloudflare R2 permanently. The server checks each one again before deleting, and keeps any that are back in use."
              confirmLabel="Delete files"
              onConfirm={deleteAll}
            />
          </div>
        </div>
      )}
    </div>
  )
}
