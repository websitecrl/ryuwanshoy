'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, BookOpen, Trash2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Tables } from '@/types/database'

type Chapter = Tables<'chapters'> & { series: { title: string } | null }

export default function AdminChaptersPage() {
  const [chapters,   setChapters]   = useState<Chapter[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Chapter | null>(null)
  const [search,     setSearch]     = useState('')

  const filteredChapters = chapters.filter(c => {
    const searchLower = search.toLowerCase()
    if (!searchLower) return true
    return (
      `chapter ${c.chapter_number}`.includes(searchLower) ||
      (c.title?.toLowerCase().includes(searchLower) ?? false) ||
      (c.series?.title?.toLowerCase().includes(searchLower) ?? false)
    )
  })

  useEffect(() => {
    async function fetchChapters() {
      try {
        const res  = await fetch('/api/chapters/all')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to fetch chapters')
        // /api/chapters/all returns every chapter regardless of publish
        // state (drafts included) — that's what /admin/drafts needs, but
        // this table is the "published chapters" list, mirroring how
        // /admin/series only shows published series and leaves drafts to
        // the Drafts page. Without this filter, draft chapters showed up
        // here too, duplicated with their entry on /admin/drafts.
        setChapters((data as Chapter[]).filter(c => c.is_published))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchChapters()
  }, [])

  async function confirmDelete() {
    if (!pendingDelete) return
    const chapter = pendingDelete
    const label = `Chapter ${chapter.chapter_number}${chapter.title ? ` — ${chapter.title}` : ''}`
    setPendingDelete(null)
    setDeletingId(chapter.id)
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setChapters(prev => prev.filter(c => c.id !== chapter.id))
      toast.success(`${label} deleted`)
    } catch {
      toast.error('Failed to delete chapter')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map(n => (
          <div key={n} className="h-16 rounded-xl animate-pulse"
            style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 animate-page-in">

      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
            style={{ color: 'var(--ryu-primary-deep)' }}>
            Admin · {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
          </div>
          <h1 className="font-heading font-bold leading-tight"
            style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)' }}>
            Chapters
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>
            To add a chapter, go to a series first and create it from there.
          </p>
          {chapters.length > 0 && (
            <div className="relative mt-4" style={{ maxWidth: 360 }}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--ryu-text-muted)' }} />
              <input
                type="text"
                placeholder="Search by chapter, title, or series..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-4 rounded-lg text-sm outline-none"
                style={{
                  border: '1px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-2)',
                  color: 'var(--ryu-text)',
                  fontFamily: "'Quicksand', system-ui, sans-serif",
                }}
              />
            </div>
          )}
        </div>
        <Link href="/admin/series">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0"
            style={{
              background: '#FEF08A', color: '#1E1E1E',
              border: '1px solid #D4B800',
              boxShadow: '0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
              cursor: 'pointer',
            }}>
            <Plus size={16} strokeWidth={2.5} /> New Chapter
          </button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-6"
          style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {chapters.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl p-16 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}>
            <BookOpen size={26} />
          </span>
          <div className="font-heading font-semibold text-lg mb-1" style={{ color: 'var(--ryu-text)' }}>
            No chapters yet
          </div>
          <p className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>
            Create a series first, then add chapters to it.
          </p>
        </div>
      )}

      {chapters.length > 0 && filteredChapters.length === 0 && (
        <div className="rounded-xl p-12 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
          <p className="text-sm" style={{ color: 'var(--ryu-text-muted)' }}>
            No chapters match "<strong>{search}</strong>"
          </p>
          <button onClick={() => setSearch('')} className="mt-3 text-xs underline"
            style={{ color: 'var(--ryu-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear search
          </button>
        </div>
      )}

      {/* Chapters table */}
      {filteredChapters.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ryu-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ryu-surface-3)', borderBottom: '1px solid var(--ryu-border)' }}>
                {['Chapter', 'Series', 'Title', 'Published', 'Actions'].map(h => (
                  <th key={h}
                    className={`px-5 py-3 font-semibold font-mono-ryu text-[10.5px] tracking-widest uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--ryu-text-2)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredChapters.map((c, i) => (
                <tr key={c.id}
                  style={{ background: 'var(--ryu-surface-1)', borderBottom: i < filteredChapters.length - 1 ? '1px solid var(--ryu-border-soft)' : 'none' }}>

                  <td className="px-5 py-3">
                    <span className="font-heading font-semibold" style={{ color: 'var(--ryu-text)', fontSize: 13.5 }}>
                      Chapter {c.chapter_number}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    {c.series?.title
                      ? <span style={{ color: 'var(--ryu-text-2)', fontSize: 13 }}>{c.series.title}</span>
                      : <span style={{ color: 'var(--ryu-text-3)' }}>—</span>
                    }
                  </td>

                  <td className="px-5 py-3">
                    {c.title
                      ? <span className="font-mono-ryu text-[11px] tracking-widest uppercase" style={{ color: 'var(--ryu-text)', fontWeight: 600 }}>{c.title}</span>
                      : <span style={{ color: 'var(--ryu-text-3)', fontStyle: 'italic', fontSize: 12 }}>Untitled</span>
                    }
                  </td>

                  <td className="px-5 py-3 font-mono-ryu text-[11px]" style={{ color: 'var(--ryu-text-2)' }}>
                    {c.published_at
                      ? new Date(c.published_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                      : <span style={{ color: 'var(--ryu-text-3)' }}>—</span>
                    }
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">

                      {/* Edit */}
                      <Link href={`/admin/chapters/${c.id}`}>
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-2)', cursor: 'pointer' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-primary)'; el.style.color = 'var(--ryu-primary-deep)' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-border)'; el.style.color = 'var(--ryu-text-2)' }}
                        >
                          <Pencil size={14} />
                        </button>
                      </Link>

                      {/* Delete — AlertDialog, no nested button */}
                      <AlertDialog
                        open={pendingDelete?.id === c.id}
                        onOpenChange={open => { if (!open) setPendingDelete(null) }}
                      >
                        <AlertDialogTrigger
                          disabled={deletingId === c.id}
                          onClick={() => setPendingDelete(c)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-2)', cursor: 'pointer' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#FECACA'; el.style.color = '#DC2626' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-border)'; el.style.color = 'var(--ryu-text-2)' }}
                        >
                          {deletingId === c.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Chapter {c.chapter_number}{c.title ? ` — ${c.title}` : ''}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the chapter and all its pages. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={confirmDelete}
                              style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}