'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'

interface Props {
    id: string
    title: string
}

export default function DeleteSeriesButton({ id, title }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleDelete() {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/series/${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error (data.error ?? 'Failed to delete series')
            }

            setOpen(false)
            router.push('/admin/series')
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }  
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                Delete Series
            </DialogTrigger>

        <DialogContent>
            <DialogHeader>
            <DialogTitle>Delete &quot;{title}&quot;?</DialogTitle>
            <DialogDescription>
                This will permanently delete the series and all its chapters and
                pages. This action cannot be undone.
            </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Yes, delete it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    )
}