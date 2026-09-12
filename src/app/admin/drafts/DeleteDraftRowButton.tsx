'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Props = {
  kind: 'series' | 'chapter'
  id: string
  label: string
}

export default function DeleteDraftRowButton({ kind, id, label }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const endpoint = kind === 'series' ? `/api/series/${id}` : `/api/chapters/${id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={deleting}
        className="flex items-center justify-center rounded-lg shrink-0 disabled:opacity-50"
        style={{
          width: 28, height: 28, cursor: 'pointer',
          background: 'transparent', border: '1px solid transparent', color: 'var(--ryu-text-3)',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ryu-text-3)'}
        title="Delete"
      >
        <Trash2 size={13} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {kind === 'series' ? 'draft series' : 'draft chapter'}?</AlertDialogTitle>
          <AlertDialogDescription>
            "{label}" will be permanently deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
          >
            <Trash2 size={13} />
            {deleting ? 'Deleting...' : 'Yes, delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
