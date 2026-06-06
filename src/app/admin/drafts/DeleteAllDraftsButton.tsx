'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function DeleteAllDraftsButton({ count }: { count: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  if (count === 0) return null

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      const res = await fetch('/api/drafts', { method: 'DELETE' })
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
            This will permanently delete all draft series and unpublished chapters. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={deleting}
            style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
          >
            <Trash2 size={13} />
            {deleting ? 'Deleting...' : 'Yes, delete all'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}