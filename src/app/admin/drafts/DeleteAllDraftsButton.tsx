'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import DeleteButton from '@/components/admin/DeleteButton'
import type { DraftPreview, DeleteDraftsResult } from '@/lib/drafts'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Bulk delete of every draft. Opening the dialog loads a fresh preview (the
 * page's count may be stale, and the admin must see exactly what will be
 * deleted); the confirm button stays disabled until that preview is in, and
 * the server deletes only the ids that were shown.
 */
export default function DeleteAllDraftsButton({ count }: { count: number }) {
  const router = useRouter()
  const [preview, setPreview]     = useState<DraftPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  if (count === 0) return null

  async function loadPreview(open: boolean) {
    if (!open) return
    setPreview(null)
    setLoadError(null)
    try {
      const res  = await fetch('/api/drafts')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load drafts')
      setPreview(json as DraftPreview)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load drafts')
    }
  }

  // Throws on failure; DeleteButton keeps its dialog open and shows the error.
  async function handleDeleteAll() {
    if (!preview) return
    // Send back exactly what was shown; the server deletes only those.
    const res = await fetch('/api/drafts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesIds:  preview.series.map(s => s.id),
        chapterIds: preview.chapters.map(c => c.id),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to delete drafts')

    const { deleted, imageCleanupFailed } = json as DeleteDraftsResult
    toast.success(`Deleted ${plural(deleted.series.length, 'series', 'series')} and ${plural(deleted.totalChapters, 'chapter')}`)
    if (imageCleanupFailed > 0) {
      toast.error(`${plural(imageCleanupFailed, 'image')} couldn't be removed from storage — check the logs`)
    }
    router.refresh()
  }

  const nothingToDelete = preview !== null && preview.count === 0

  const description = loadError
    ? loadError
    : !preview
      ? 'Loading drafts…'
      : nothingToDelete
        ? 'There are no drafts to delete.'
        : `This will permanently delete ${plural(preview.series.length, 'draft series', 'draft series')} and ${plural(preview.totalChapters, 'unpublished chapter')}, plus their images${preview.heroSlideCount ? ` and ${plural(preview.heroSlideCount, 'hero slide')}` : ''}. Published chapters are never deleted. This cannot be undone.`

  return (
    <DeleteButton
      variant="pill"
      label="Delete all drafts"
      title="Delete all drafts?"
      description={description}
      confirmLabel={preview ? `Yes, delete ${plural(preview.count, 'item')}` : 'Yes, delete all'}
      confirmDisabled={!preview || nothingToDelete}
      onOpenChange={open => void loadPreview(open)}
      onConfirm={handleDeleteAll}
    >
      {preview && !nothingToDelete && (
        <div className="max-h-60 overflow-y-auto text-[13px] rounded-lg border border-[var(--ryu-border)]
                        bg-[var(--ryu-surface-1)] px-3 py-2.5">
          {preview.series.length > 0 && (
            <>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ryu-text-3)]">
                Series
              </div>
              <ul className="mb-2 pl-4 list-disc text-[var(--ryu-text)]">
                {preview.series.map(s => (
                  <li key={s.id}>
                    {s.title}
                    <span className="text-[var(--ryu-text-3)]"> · {plural(s.chapterCount, 'chapter')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {preview.chapters.length > 0 && (
            <>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ryu-text-3)]">
                Chapters in other series
              </div>
              <ul className="pl-4 list-disc text-[var(--ryu-text)]">
                {preview.chapters.map(c => (
                  <li key={c.id}>
                    {c.seriesTitle ?? 'No series'} — Ch. {c.chapter_number}
                    {c.title && <span className="text-[var(--ryu-text-3)]"> · {c.title}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </DeleteButton>
  )
}
