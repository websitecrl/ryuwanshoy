'use client'

import { useRouter } from 'next/navigation'
import DeleteButton from '@/components/admin/DeleteButton'

type Props = {
  kind: 'series' | 'chapter'
  id: string
  label: string
}

/** Deletes one draft series or chapter, then refreshes the drafts list. */
export default function DeleteDraftRowButton({ kind, id, label }: Props) {
  const router = useRouter()

  // Throws on failure; DeleteButton keeps its dialog open and shows the error
  // (this used to fail silently with only a console.error).
  async function handleDelete() {
    const endpoint = kind === 'series' ? `/api/series/${id}` : `/api/chapters/${id}`
    const res = await fetch(endpoint, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(json.error ?? 'Failed to delete draft')
    }
    router.refresh()
  }

  return (
    <DeleteButton
      size={28}
      label={kind === 'series' ? 'Delete draft series' : 'Delete draft chapter'}
      title={`Delete this ${kind === 'series' ? 'draft series' : 'draft chapter'}?`}
      description={`“${label}” will be permanently deleted. This cannot be undone.`}
      successMessage="Draft deleted"
      onConfirm={handleDelete}
    />
  )
}
