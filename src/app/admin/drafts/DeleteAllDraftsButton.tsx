'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { DraftPreview, DeleteDraftsResult } from '@/lib/drafts'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function DeleteAllDraftsButton({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [preview, setPreview]   = useState<DraftPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (count === 0) return null

  // Load a fresh preview every time the dialog opens — the page's count may
  // be stale, and the admin must see exactly what will be deleted.
  async function handleOpenChange(next: boolean) {
    if (deleting) return
    setOpen(next)
    if (!next) return
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

  async function handleDeleteAll() {
    if (!preview) return
    setDeleting(true)
    try {
      // Send back exactly what was shown; the server deletes only those.
      const res = await fetch('/api/drafts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesIds:  preview.series.map(s => s.id),
          chapterIds: preview.chapters.map(c => c.id),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete drafts')

      const { deleted, imageCleanupFailed } = json as DeleteDraftsResult
      toast.success(`Deleted ${plural(deleted.series.length, 'series', 'series')} and ${plural(deleted.totalChapters, 'chapter')}`)
      if (imageCleanupFailed > 0) {
        toast.error(`${plural(imageCleanupFailed, 'image')} couldn't be removed from storage — check the logs`)
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete drafts')
    } finally {
      setDeleting(false)
    }
  }

  const nothingToDelete = preview !== null && preview.count === 0

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
    <AlertDialogTrigger
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
        background: '#FEE2E2', color: '#DC2626',
        border: '1px solid #FECACA', fontSize: 13, fontWeight: 600,
      }}
    >
      <Trash2 size={13} />
      Delete all drafts
    </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all drafts?</AlertDialogTitle>
          <AlertDialogDescription>
            {loadError
              ? loadError
              : !preview
                ? 'Loading drafts…'
                : nothingToDelete
                  ? 'There are no drafts to delete.'
                  : `This will permanently delete ${plural(preview.series.length, 'draft series', 'draft series')} and ${plural(preview.totalChapters, 'unpublished chapter')}, plus their images${preview.heroSlideCount ? ` and ${plural(preview.heroSlideCount, 'hero slide')}` : ''}. Published chapters are never deleted. This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {preview && !nothingToDelete && (
          <div
            style={{
              maxHeight: 240, overflowY: 'auto', fontSize: 13,
              border: '1px solid var(--ryu-border)', borderRadius: 8,
              background: 'var(--ryu-surface-1)', padding: '10px 12px',
            }}
          >
            {preview.series.length > 0 && (
              <>
                <div style={{ color: 'var(--ryu-text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Series
                </div>
                <ul style={{ margin: '0 0 8px', paddingLeft: 16, color: 'var(--ryu-text)' }}>
                  {preview.series.map(s => (
                    <li key={s.id}>
                      {s.title}
                      <span style={{ color: 'var(--ryu-text-3)' }}> · {plural(s.chapterCount, 'chapter')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.chapters.length > 0 && (
              <>
                <div style={{ color: 'var(--ryu-text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Chapters in other series
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--ryu-text)' }}>
                  {preview.chapters.map(c => (
                    <li key={c.id}>
                      {c.seriesTitle ?? 'No series'} — Ch. {c.chapter_number}
                      {c.title && <span style={{ color: 'var(--ryu-text-3)' }}> · {c.title}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={deleting || !preview || nothingToDelete}
            style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
          >
            <Trash2 size={13} />
            {deleting ? 'Deleting...' : preview ? `Yes, delete ${plural(preview.count, 'item')}` : 'Yes, delete all'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
