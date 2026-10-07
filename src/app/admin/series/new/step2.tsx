'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { X, CloudUpload, GripVertical, CheckCircle2, Circle, ArrowLeft } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COMIC_PAGE_MAX_WIDTH, COMIC_PAGE_MAX_HEIGHT } from '@/lib/constants'
import { Card, CardLabel } from './components'
import { BOTTOM_BAR, inputStyle, labelStyle, getImageDimensions, type LocalPage, type SaveState } from './types'

// ── Sortable page card ─────────────────────────────────────────────────────

function SortablePage({
  page, idx, onRemove,
}: {
  page: LocalPage
  idx: number
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        aspectRatio: page.is_spread ? '920 / 640' : '460 / 640',
        gridColumn: page.is_spread ? 'span 2' : undefined,
        borderRadius: 8,
        overflow: 'hidden',
        border: '2px solid var(--ryu-border)',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <Image src={page.preview} alt={`Page ${idx + 1}`} fill className="object-cover" />

      {/* Page number + spread badge */}
      <div style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: 4, zIndex: 3 }}>
        <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace', letterSpacing: 0.5 }}>
          P{String(idx + 1).padStart(2, '0')}
        </span>
        {page.is_spread && (
          <span style={{ background: 'var(--ryu-primary)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, letterSpacing: 0.5 }}>
            SPREAD
          </span>
        )}
      </div>

      {/* Remove button — stops drag from firing */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove(page.id) }}
        style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 99, background: 'rgba(28,25,23,0.8)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 3 }}
>
  <X size={13} />
      </button>

      {/* Drag hint */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '4px 0', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase', zIndex: 3 }}>
        drag to reorder
      </div>
    </div>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────

interface Step2Props {
  chapterTitle: string
  onChapterTitleChange: (title: string) => void
  // Pages live in the wizard so they (and their upload status) survive going back
  pages: LocalPage[]
  setPages: React.Dispatch<React.SetStateAction<LocalPage[]>>
  saving: SaveState
  onBack: () => void
  onNext: () => void
  onSaveDraft: () => void
}

export default function Step2({ chapterTitle, onChapterTitleChange, pages, setPages, saving, onBack, onNext, onSaveDraft }: Step2Props) {
  const [dragOver,     setDragOver]     = useState(false)
  const [reversed,     setReversed]     = useState(false)
  const submitting = saving !== null

  const fileInputRef = useRef<HTMLInputElement>(null)

  // dnd-kit sensors — pointer only (works mouse + touch)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPages(prev => {
      const oldIdx = prev.findIndex(p => p.id === active.id)
      const newIdx = prev.findIndex(p => p.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  /**
   * Turns picked/dropped files into local page entries and appends them.
   *
   * Keeps the exact order the browser hands over — no filename sort, since
   * names like "day_two" / "day_three" don't sort into reading order.
   * Fine-tune afterwards with drag-and-drop or the reverse switch.
   *
   * @param files - raw files from the input or drop event; non-images are ignored
   */
  async function handleFiles(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    const newPages: LocalPage[] = await Promise.all(imageFiles.map(async file => {
      const preview   = URL.createObjectURL(file)
      const dim       = await getImageDimensions(file)
      const is_spread  = dim.width > COMIC_PAGE_MAX_WIDTH
      const oversized  = is_spread
        ? dim.width > COMIC_PAGE_MAX_WIDTH * 2 || dim.height > COMIC_PAGE_MAX_HEIGHT
        : dim.width > COMIC_PAGE_MAX_WIDTH || dim.height > COMIC_PAGE_MAX_HEIGHT
      if (oversized) toast.warning(`"${file.name}" exceeds max size — it'll still upload.`)
      return { id: crypto.randomUUID(), file, preview, width: dim.width, height: dim.height, oversized, is_spread }
    }))
    setPages(prev => [...prev, ...newPages])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }
  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true) }
  function handleDragLeave()                    { setDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }
  function removePage(id: string) { setPages(prev => prev.filter(p => p.id !== id)) }

  /** Flips the whole reading order (first ↔ last). Toggling again restores it. */
  function toggleReversed() {
    setPages(prev => [...prev].reverse()) // copy first — .reverse() mutates in place
    setReversed(r => !r)
  }

  /** Nothing is saved on "Next"; "Save as draft" creates the rows via the wizard. */
  function proceed(destination: 'draft' | 'next') {
    if (pages.length === 0) { toast.error('Upload at least one page'); return }
    if (destination === 'draft') onSaveDraft()
    else onNext()
  }

  const quickCheck = [
    { label: 'Chapter 1 ready',                              done: true },
    { label: `At least one page uploaded (${pages.length})`, done: pages.length > 0 },
    { label: 'Chapter title (optional)',                      done: chapterTitle.trim().length > 0 },
  ]

  return (
    <>
      <div className="flex flex-1 min-h-0 overflow-y-auto gap-6 px-8 pb-4 max-w-8xl mx-auto w-full">
        <div className="flex-1 space-y-5">

          {/* 01 Chapter details */}
          <Card>
            <CardLabel n="01" title="Chapter details" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>
                  Chapter title
                  <span style={{ float: 'right', fontSize: 11, fontWeight: 400, color: 'var(--ryu-text-3)' }}>optional · readers see this on the index</span>
                </label>
                <input style={inputStyle} value={chapterTitle} onChange={e => onChapterTitleChange(e.target.value)} placeholder="The Beginning" />
              </div>
            </div>
          </Card>

          {/* 02 Pages */}
          <Card>
            <CardLabel n="02" title="Pages">
              {pages.length > 1 && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={reversed}
                  onClick={toggleReversed}
                  disabled={submitting}
                  style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ryu-text)', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Reverse order
                  <span style={{ width: 32, height: 18, borderRadius: 9, padding: 2, background: reversed ? 'var(--ryu-primary)' : 'var(--ryu-border)', transition: 'background 150ms ease', display: 'flex' }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--ryu-surface-1)', transform: reversed ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 150ms ease' }} />
                  </span>
                </button>
              )}
            </CardLabel>

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: `1.5px dashed ${dragOver ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`, background: dragOver ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-2)', marginBottom: 16, transition: 'all 150ms ease' }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CloudUpload size={18} />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 2 }}>Select comic pages</p>
                <p style={{ fontSize: 11.5, color: 'var(--ryu-text-3)' }}>Drop multiple files at once · JPG / PNG / WebP · up to 25 MB per page</p>
              </div>
              {pages.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ryu-text-2)', whiteSpace: 'nowrap' }}>{pages.length} uploaded</span>}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                + Browse files
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </div>

            {/* Sortable grid */}
            {pages.length > 0 && (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                    <div style={{ maxHeight: 'max(200px, calc(100dvh - 600px))', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                      {pages.map((page, idx) => (
                        <SortablePage key={page.id} page={page} idx={idx} onRemove={removePage} />
                      ))}
                      {/* Add more cell */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{ aspectRatio: '460/640', borderRadius: 8, border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}
                      >
                        <span style={{ fontSize: 20, color: 'var(--ryu-text-3)' }}>+</span>
                        <p style={{ fontSize: 10, color: 'var(--ryu-text-3)' }}>Add pages</p>
                      </div>
                    </div>
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="w-64 shrink-0 hidden lg:block" style={{ alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
          <div className="space-y-4">
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase" style={{ color: 'var(--ryu-text-2)' }}>Reading Order</div>
                {pages.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', border: '1px solid var(--ryu-border)' }}>{pages.length} pages</span>}
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pages.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--ryu-text-3)', textAlign: 'center', padding: '20px 0' }}>No pages yet</p>
                  : pages.map((page, idx) => (
                    <div key={page.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
                      <GripVertical size={12} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                      <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        <Image src={page.preview} alt={`p${idx + 1}`} fill className="object-cover" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ryu-text)' }}>Page {idx + 1}</p>
                          {page.is_spread && (
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}>
                              SPREAD
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--ryu-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.file.name}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </Card>

            <Card>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-3" style={{ color: 'var(--ryu-text-2)' }}>How to reorder</div>
              <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Grab any page and drag it.',
                  'Drop it in the new position.',
                  'Numbers update automatically.',
                ].map((tip, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--ryu-text-2)', lineHeight: 1.4 }}>{tip}</li>
                ))}
              </ol>
            </Card>

            <Card>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-3" style={{ color: 'var(--ryu-text-2)' }}>Quick Check</div>
              {quickCheck.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  {item.done ? <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0 }} /> : <Circle size={14} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 12.5, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}>{item.label}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={BOTTOM_BAR}>
        <button
          onClick={onBack}
          disabled={submitting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: submitting ? 'var(--ryu-text-3)' : 'var(--ryu-text-2)', background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          <ArrowLeft size={15} /> Back to series info
        </button>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!submitting && (
            <button
              onClick={() => proceed('draft')}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Save as draft
            </button>
          )}
          <button
            disabled={submitting || pages.length === 0}
            onClick={() => proceed('next')}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid var(--ryu-primary-deep)', background: 'var(--ryu-primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: pages.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: pages.length === 0 ? 0.5 : 1, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
          >
            Next — Preview →
          </button>
        </div>
      </div>
    </>
  )
}