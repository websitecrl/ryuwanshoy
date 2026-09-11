'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { CloudUpload, X, CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import type { Tables } from '@/types/database'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Series   = Tables<'series'>
type SaveMode = 'draft' | 'publish'

type PageFile = {
  id: string; file: File; preview: string
  uploading: boolean; uploaded: boolean; error: string | null
  /** True when the image is landscape (wider than tall) — flagged as a two-page spread. */
  isSpread: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--ryu-surface-2)',
  border: '1px solid var(--ryu-border)', borderRadius: 6,
  padding: '10px 12px', fontSize: 14, color: 'var(--ryu-text)',
  fontFamily: 'inherit', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600,
  color: 'var(--ryu-text)', marginBottom: 6,
}

/**
 * A single draggable/sortable comic page thumbnail.
 * Must be its own component (not inlined in a .map callback) because
 * useSortable is a hook and needs one call per item.
 */
function SortablePageThumbnail({
  page, index, onRemove,
}: {
  page: PageFile
  index: number
  onRemove: (id: string) => void
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: page.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group">
      <div style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', border: `2px solid ${page.error ? '#FCA5A5' : page.uploaded ? '#86EFAC' : 'var(--ryu-border)'}` }}>
        <Image src={page.preview} alt={`Page ${index + 1}`} fill className="object-cover" draggable={false} />

        {page.uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={14} className="animate-spin text-white" />
          </div>
        )}
        {page.uploaded && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={14} style={{ color: '#86EFAC' }} />
          </div>
        )}
        {!page.uploading && !page.uploaded && (
          <button
            type="button"
            // Stop the pointer event from reaching the drag sensor so a click
            // on the remove button doesn't get swallowed as a drag start.
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(page.id)}
            style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 99, background: 'rgba(28,25,23,0.78)', color: '#FFFBF5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.85, zIndex: 2 }}
            className="hover:opacity-100 transition-opacity">
            <X size={9} />
          </button>
        )}

        <span className="font-mono-ryu" style={{ position: 'absolute', top: 3, left: 3, fontSize: 8, background: 'rgba(28,25,23,0.78)', color: '#FFFBF5', padding: '1px 4px', borderRadius: 3 }}>
          P{String(index + 1).padStart(2, '0')}
        </span>

        {page.isSpread && (
          <span className="font-mono-ryu" style={{ position: 'absolute', bottom: 3, right: 3, fontSize: 8, background: 'var(--ryu-primary)', color: '#fff', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
            SPREAD
          </span>
        )}
      </div>
    </div>
  )
}

export default function NewChapterPage() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const preselectedId = searchParams.get('series_id') ?? ''

  const [seriesList,       setSeriesList]       = useState<Series[]>([])
  const [loadingSeries,    setLoadingSeries]    = useState(true)
  const [selectedSeriesId, setSelectedSeriesId] = useState(preselectedId)
  const [chapterNumber,    setChapterNumber]    = useState('')
  const [existingNumbers,  setExistingNumbers]  = useState<number[]>([])
  const [chapterTitle,     setChapterTitle]     = useState('')
  const [isEarlyAccess,    setIsEarlyAccess]    = useState(false)
  const [pages,            setPages]            = useState<PageFile[]>([])
  const [dragOver,         setDragOver]         = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    // Require 8px of movement before a drag starts so ordinary clicks
    // (remove button, image preview) still register as clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const hasSeriesSelected = selectedSeriesId.length > 0
  const hasChapterNumber  = chapterNumber.trim().length > 0
  const hasPages          = pages.length > 0
  const chapterNum        = Number(chapterNumber)
  const isValidNumber     = chapterNum >= 1 && chapterNum <= 9999
  const isDuplicateNumber = existingNumbers.includes(chapterNum)

  useEffect(() => {
    async function fetchSeries() {
      try {
        const res  = await fetch('/api/series')
        const json = await res.json()
        if (Array.isArray(json)) setSeriesList(json)
      } catch { toast.error('Failed to load series') }
      finally { setLoadingSeries(false) }
    }
    fetchSeries()
  }, [])

  // ── Auto-detect next chapter number when series is selected ──
  useEffect(() => {
    if (!selectedSeriesId) return
    async function fetchNextChapter() {
      const res  = await fetch(`/api/series/${selectedSeriesId}`)
      const json = await res.json()
      if (json.data?.chapters?.length) {
        const numbers: number[] = json.data.chapters.map((c: { chapter_number: number }) => c.chapter_number)
        setExistingNumbers(numbers)
        setChapterNumber(String(Math.max(...numbers) + 1))
      } else {
        // No chapters yet — first chapter is #1, not #2.
        setExistingNumbers([])
        setChapterNumber('1')
      }
    }
    fetchNextChapter()
  }, [selectedSeriesId])

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  function addFiles(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return

    const newPages: PageFile[] = imgs.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      error: null,
      isSpread: false, // corrected below once the image loads
    }))

    setPages(prev => [...prev, ...newPages])

    // Detect spread (landscape) pages by reading actual pixel dimensions.
    // Reuses each page's own preview URL instead of allocating a second one.
    newPages.forEach(page => {
      const img = new window.Image()
      img.onload = () => {
        const isSpread = img.width > img.height
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, isSpread } : p))
      }
      img.src = page.preview
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }
  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true) }
  function handleDragLeave()                    { setDragOver(false) }
  function handleDrop(e: React.DragEvent)       { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }
  function removePage(id: string)               { setPages(prev => prev.filter(p => p.id !== id)) }

  function handlePageDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPages(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id)
      const newIndex = prev.findIndex(p => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  async function handleSubmit(mode: SaveMode) {
    if (!selectedSeriesId) { toast.error('Select a series'); return }
    if (!chapterNumber)    { toast.error('Chapter number is required'); return }
    if (!isValidNumber)    { toast.error('Chapter number must be 1 or higher'); return }
    if (isDuplicateNumber) { toast.error(`Chapter ${chapterNum} already exists in this series`); return }
    setSubmitting(true)
    try {
      const chRes  = await fetch('/api/chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: selectedSeriesId, chapter_number: chapterNum, title: chapterTitle.trim() || null, is_early_access: isEarlyAccess, is_published: mode === 'publish',  is_draft: mode === 'draft', published_at: new Date().toISOString() }),
      })
      const chJson = await chRes.json()
      if (!chRes.ok || chJson.error) { toast.error(chJson.error ?? 'Failed to create chapter'); setSubmitting(false); return }
      const chapterId = chJson.data.id

      // pages[] reflects the current (possibly reordered) sequence, so
      // page_number here always matches what's shown on screen.
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]; if (!page) continue
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: true } : p))
        try {
          const imageBase64 = await fileToBase64(page.file)
          const pgRes  = await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapter_id: chapterId, imageBase64, page_number: i + 1, is_spread: page.isSpread }) })
          const pgJson = await pgRes.json()
          setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: false, uploaded: pgRes.ok && !pgJson.error, error: (!pgRes.ok || pgJson.error) ? 'Upload failed' : null } : p))
        } catch {
          setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: false, error: 'Upload failed' } : p))
        }
      }

      mode === 'draft' ? toast.success('Chapter saved as draft') : toast.success('Chapter published!')
      router.push(mode === 'draft' ? '/admin/drafts' : '/admin/series')
    } catch { toast.error('Something went wrong'); setSubmitting(false) }
  }

  if (!loadingSeries && seriesList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8 animate-page-in">
        <p className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>No series found. Create a series first before adding chapters.</p>
        <Link href="/admin/series/new">
          <button style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Create New Series
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-8 pt-6 pb-3 text-sm font-mono-ryu" style={{ color: 'var(--ryu-text-2)' }}>
        <Link href="/admin/series" style={{ color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>Series</Link>
        <span style={{ color: 'var(--ryu-text-3)' }}>›</span>
        <span style={{ color: 'var(--ryu-text)' }}>New Chapter</span>
      </div>

      <div className="px-8 pb-6">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>Add chapter</div>
        <h1 className="font-heading font-bold" style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>New Chapter</h1>
      </div>

      {/* Main grid */}
      <div style={{ display: 'flex', flex: 1, gap: 24, padding: '0 32px 112px' }}>

        {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
        <div style={{ flex: 1, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 01 Chapter details */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18, paddingBottom: 10, borderBottom: '1px dashed var(--ryu-border)' }}>
              <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>01</span>
              <span className="font-heading" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ryu-text)' }}>Chapter details</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Series <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                {loadingSeries ? (
                  <div style={{ height: 42, borderRadius: 6, background: 'var(--ryu-surface-3)' }} className="animate-pulse" />
                ) : (
                <Select value={selectedSeriesId} onValueChange={v => setSelectedSeriesId(v ?? '')}>
                  <SelectTrigger>
                    <span style={{ color: selectedSeriesId ? 'var(--ryu-text)' : 'var(--ryu-text-3)', fontSize: 14 }}>
                      {selectedSeriesId
                        ? seriesList.find(s => s.id === selectedSeriesId)?.title ?? 'Select a series'
                        : 'Select a series'
                      }
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {seriesList.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Chapter # <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={chapterNumber}
                    onChange={e => setChapterNumber(e.target.value)}
                  />
                  {chapterNumber && !isValidNumber && <p style={{ fontSize: 11.5, color: '#DC2626', marginTop: 4 }}>Must be 1 or higher</p>}
                  {chapterNumber && isValidNumber && isDuplicateNumber && <p style={{ fontSize: 11.5, color: '#DC2626', marginTop: 4 }}>Chapter {chapterNum} already exists</p>}
                </div>
                <div>
                  <label style={labelStyle}>Title <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>(optional)</span></label>
                  <input style={inputStyle} value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} placeholder="e.g. The Beginning" />
                </div>
              </div>
            </div>
          </div>

          {/* 02 Stats + Checklist */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed var(--ryu-border)' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
                <div className="font-heading font-bold" style={{ fontSize: 24, letterSpacing: -0.5, color: 'var(--ryu-text)' }}>{pages.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ryu-text-2)', marginTop: 1 }}>Pages</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
                <div className="font-heading font-bold" style={{ fontSize: 24, letterSpacing: -0.5, color: 'var(--ryu-text)' }}>{chapterNumber || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--ryu-text-2)', marginTop: 1 }}>Chapter</div>
              </div>
            </div>
            <div className="font-mono-ryu text-[10px] tracking-widest uppercase mb-3" style={{ color: 'var(--ryu-text-2)' }}>
              Publish checklist
            </div>
            {[
              { label: 'Series selected',    done: hasSeriesSelected },
              { label: 'Chapter number set', done: hasChapterNumber && isValidNumber },
              { label: `${pages.length} page${pages.length !== 1 ? 's' : ''} uploaded`, done: hasPages },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                {item.done
                  ? <CheckCircle2 size={13} style={{ color: '#16A34A', flexShrink: 0 }} />
                  : <Circle      size={13} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}>{item.label}</span>
              </div>
            ))}
          </div>

        </div>
        {/* ── END LEFT COLUMN ──────────────────────────────────────── */}

        {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4" style={{ flex: 1, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          {/* 02 Pages */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ryu-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>02</span>
                <span className="font-heading" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ryu-text)' }}>Pages</span>
              </div>
              <span className="font-mono-ryu text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--ryu-accent)', color: '#713F12' }}>Required</span>
            </div>
            <div style={{ padding: 16 }}>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, border: `1.5px dashed ${dragOver ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`, background: dragOver ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-2)', padding: '20px 12px', cursor: 'pointer', textAlign: 'center', marginBottom: 12 }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CloudUpload size={18} />
                </span>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)' }}>Select comic pages</p>
                <p style={{ fontSize: 11, color: 'var(--ryu-text-3)' }}>Drop files · PNG, JPG, WEBP · max 25MB</p>
              </div>

              {pages.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePageDragEnd}>
                  <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                      {pages.map((page, idx) => (
                        <SortablePageThumbnail key={page.id} page={page} index={idx} onRemove={removePage} />
                      ))}
                      <div onClick={() => fileInputRef.current?.click()}
                        style={{ aspectRatio: '3/4', borderRadius: 6, border: '1.5px dashed var(--ryu-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 3 }}>
                        <span style={{ fontSize: 18, color: 'var(--ryu-text-3)' }}>+</span>
                        <p style={{ fontSize: 9.5, color: 'var(--ryu-text-3)' }}>Add more</p>
                      </div>
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ryu-text-3)' }}>
                <AlertCircle size={12} style={{ color: 'var(--ryu-primary-deep)', flexShrink: 0 }} />
                Drag to reorder · upload in reading order
              </div>
            </div>
          </div>


        </div>
        {/* ── END RIGHT COLUMN ─────────────────────────────────────── */}

      </div>

      {/* Bottom action bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to top, var(--background) 60%, transparent)', padding: '20px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <button
          disabled={submitting}
          onClick={() => router.push('/admin/series')}
          style={{
            fontSize: 13.5, fontWeight: 600,
            color: submitting ? 'var(--ryu-text-3)' : '#DC2626',
            background: 'none', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 0, opacity: submitting ? 0.5 : 1,
            transition: 'color 150ms, opacity 150ms',
          }}
        >
          Discard
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
              disabled={submitting || !hasSeriesSelected || !hasChapterNumber || !isValidNumber || isDuplicateNumber}
              onClick={() => handleSubmit('draft')}
              style={{
                display: submitting ? 'none' : 'flex',
                alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 8,
                border: '1px solid var(--ryu-border)',
                background: 'var(--ryu-surface-1)',
                color: 'var(--ryu-text)',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                opacity: (!hasSeriesSelected || !hasChapterNumber || !isValidNumber || isDuplicateNumber) ? 0.5 : 1,
              }}
            >
              Save as draft
            </button>
          <button disabled={submitting || !hasSeriesSelected || !hasChapterNumber || !hasPages || !isValidNumber || isDuplicateNumber} onClick={() => handleSubmit('publish')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-primary-deep)', background: 'var(--ryu-primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.06)', opacity: (!hasSeriesSelected || !hasChapterNumber || !hasPages || !isValidNumber || isDuplicateNumber) ? 0.5 : 1 }}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Publish chapter
          </button>
        </div>
      </div>

    </div>
  )
}