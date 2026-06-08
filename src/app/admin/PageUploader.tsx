'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { CloudUpload, X, AlertCircle } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Database } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = Database['public']['Tables']['pages']['Row']

// ─── Single sortable page thumbnail ──────────────────────────────────────────

interface SortablePageProps {
  page: Page
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SortablePage({ page, onDelete, isDeleting }: SortablePageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
    >
      <div style={{
        position: 'relative', aspectRatio: '2/3', borderRadius: 8,
        overflow: 'hidden', border: '1.5px solid var(--ryu-border)',
        background: 'var(--ryu-surface-2)',
      }}>
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'grab' }}
          className="active:cursor-grabbing"
        />

        <Image
          src={page.image_url}
          alt={`Page ${page.page_number}`}
          fill
          className="object-cover"
          sizes="120px"
        />

        {/* Page number badge */}
        <span
          className="font-mono-ryu"
          style={{
            position: 'absolute', bottom: 4, left: 4, zIndex: 20,
            fontSize: 8, background: 'rgba(28,25,23,0.78)',
            color: '#FFFBF5', padding: '1px 5px', borderRadius: 3,
          }}
        >
          P{String(page.page_number).padStart(2, '0')}
        </span>

        {/* Delete button */}
        <button
          onClick={() => onDelete(page.id)}
          disabled={isDeleting}
          style={{
            position: 'absolute', top: 4, right: 4, zIndex: 20,
            width: 20, height: 20, borderRadius: 99,
            background: 'rgba(220,38,38,0.85)', color: '#fff',
            border: 'none', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
            opacity: 0, transition: 'opacity 150ms ease',
          }}
          className="group-hover:opacity-100 disabled:cursor-not-allowed"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  )
}

// ─── Main PageUploader ────────────────────────────────────────────────────────

interface PageUploaderProps {
  chapterId: string
  initialPages?: Page[]
}

export default function PageUploader({
  chapterId,
  initialPages = [],
}: PageUploaderProps) {
  const [pages,      setPages]      = useState<Page[]>(initialPages)
  const [uploading,  setUploading]  = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver,   setDragOver]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  // ── Shared upload logic ──────────────────────────────────────────────────
  function getImageDimensionns(file: File): Promise<{ width: number; height: number }> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
      img.src = url
    })
  }


  const uploadFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setError(null)
    setUploading(true)

    // Sort by filename so 001.jpg uploads before 002.jpg
    imgs.sort((a, b) => a.name.localeCompare(b.name))

    try {
      const uploaded: Page[] = []
      for (const file of imgs) {
        const base64      = await fileToBase64(file)
        const page_number = pages.length + uploaded.length + 1
        const dim         = await getImageDimensionns(file)
        const is_spread   = dim.width > dim.height    // landscape = spread
        const res  = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter_id: chapterId, imageBase64: base64, page_number, is_spread }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
        uploaded.push(data.data)
      }
      setPages(prev => [...prev, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [chapterId, pages.length])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    uploadFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true) }
  function handleDragLeave()                    { setDragOver(false) }
  function handleDrop(e: React.DragEvent)       {
    e.preventDefault(); setDragOver(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this page?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete page')
      setPages(prev =>
        prev.filter(p => p.id !== id).map((p, i) => ({ ...p, page_number: i + 1 }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally { setDeletingId(null) }
  }

  // ── Reorder ──────────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pages.findIndex(p => p.id === active.id)
    const newIndex = pages.findIndex(p => p.id === over.id)
    const reordered = arrayMove(pages, oldIndex, newIndex).map((p, i) => ({
      ...p, page_number: i + 1,
    }))
    setPages(reordered)

    try {
      const res = await fetch('/api/pages/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: reordered.map(p => ({ id: p.id, page_number: p.page_number })) }),
      })
      if (!res.ok) throw new Error('Failed to reorder pages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 8, padding: '10px 14px', fontSize: 13,
          background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626',
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Styled drop zone ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8, borderRadius: 10, textAlign: 'center',
          padding: '28px 16px', cursor: uploading ? 'not-allowed' : 'pointer',
          border: `1.5px dashed ${dragOver ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`,
          background: dragOver ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-2)',
          transition: 'border-color 150ms ease, background 150ms ease',
          opacity: uploading ? 0.7 : 1,
        }}
      >
        <span style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--ryu-primary-soft)',
          color: 'var(--ryu-primary-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CloudUpload size={18} />
        </span>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)', margin: 0 }}>
          {uploading ? 'Uploading…' : 'Select comic pages'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--ryu-text-3)', margin: 0 }}>
          {uploading
            ? 'Please wait'
            : 'Drop files · PNG, JPG, WEBP · max 25MB'}
        </p>
      </div>

      {/* ── Page grid ────────────────────────────────────────────────────── */}
      {pages.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8,
            }}>
              {pages.map(page => (
                <SortablePage
                  key={page.id}
                  page={page}
                  onDelete={handleDelete}
                  isDeleting={deletingId === page.id}
                />
              ))}
              {/* Add more tile */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  aspectRatio: '2/3', borderRadius: 8,
                  border: '1.5px dashed var(--ryu-border)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 4,
                  background: 'var(--ryu-surface-2)',
                }}
              >
                <span style={{ fontSize: 18, color: 'var(--ryu-text-3)' }}>+</span>
                <p style={{ fontSize: 9, color: 'var(--ryu-text-3)', margin: 0 }}>Add</p>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Hint */}
      <p style={{ fontSize: 11, color: 'var(--ryu-text-3)', margin: 0 }}>
        Name files <span style={{ fontFamily: 'monospace' }}>001.jpg, 002.jpg</span> — they upload in filename order.
        Drag thumbnails to reorder.
      </p>

    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}