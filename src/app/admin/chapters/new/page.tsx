'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { CloudUpload, X, CheckCircle2, Circle, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import type { Tables } from '@/types/database'
import {
  DndContext, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { UNREADABLE_IMAGE_MESSAGE } from '@/lib/image-compress'
import { describePageError, isSpreadPage, keepImageFiles, uploadComicPage, warnIfOversizedPage } from '@/lib/page-files'
import { setPublished } from '@/app/admin/series/new/save'
import { SORTABLE_TOUCH_STYLE, usePageSortSensors } from '@/lib/dnd-sensors'

type Series   = Tables<'series'>
type SaveMode = 'draft' | 'publish'

type PageFile = {
  id: string; file: File; preview: string
  uploading: boolean; uploaded: boolean; error: string | null
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

/** sortable thumbnail (useSortable needs its own component). locked -> no dragging */
function SortablePageThumbnail({
  page, index, onRemove, locked,
}: {
  page: PageFile
  index: number
  onRemove: (id: string) => void
  locked: boolean
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: page.id, disabled: locked })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: locked ? 'default' : 'grab',
    ...SORTABLE_TOUCH_STYLE,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group">
      <div style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', border: `2px solid ${page.error ? 'var(--ryu-danger-border)' : page.uploaded ? 'var(--ryu-success-border)' : 'var(--ryu-border)'}` }}>
        <Image src={page.preview} alt={`Page ${index + 1}`} fill className="object-cover pointer-events-none" draggable={false} />

        {page.uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--ryu-shadow) 60%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={14} className="animate-spin text-[var(--ryu-on-image)]" />
          </div>
        )}
        {page.uploaded && (
          <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--ryu-success) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--ryu-success-border)' }} />
          </div>
        )}
        {!page.uploading && !page.uploaded && (
          <button
            type="button"
            // remove tap != drag start (the sensors listen for mousedown and touchstart)
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={() => onRemove(page.id)}
            style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 99, background: 'color-mix(in srgb, var(--ryu-shadow) 78%, transparent)', color: 'var(--ryu-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.85, zIndex: 2 }}
            className="tap-area max-md:w-7! max-md:h-7! hover:opacity-100 transition-opacity">
            <X size={9} />
          </button>
        )}

        <span className="font-mono-ryu" style={{ position: 'absolute', top: 3, left: 3, fontSize: 8, background: 'color-mix(in srgb, var(--ryu-shadow) 78%, transparent)', color: 'var(--ryu-bg)', padding: '1px 4px', borderRadius: 3 }}>
          P{String(index + 1).padStart(2, '0')}
        </span>

        {page.isSpread && (
          <span className="font-mono-ryu" style={{ position: 'absolute', bottom: 3, right: 3, fontSize: 8, background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
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
  const [seriesIsPublished, setSeriesIsPublished] = useState<boolean | null>(null)
  const [chapterNumber,    setChapterNumber]    = useState('')
  const [existingNumbers,  setExistingNumbers]  = useState<number[]>([])
  const [chapterTitle,     setChapterTitle]     = useState('')
  const [isEarlyAccess]    = useState(false)
  const [pages,            setPages]            = useState<PageFile[]>([])
  const [dragOver,         setDragOver]         = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  // row created by an earlier attempt -> a retry reuses it (never a second chapter)
  const savedChapterId = useRef<string | null>(null)
  // row exists -> details and page order are locked (the server already has them)
  const [chapterSaved,     setChapterSaved]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // mouse: 8px -> drag, less -> click (as before); touch: press and hold, a swipe scrolls
  const sensors = usePageSortSensors(8)

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

  useEffect(() => {
    if (!selectedSeriesId) return
    async function fetchNextChapter() {
      const res  = await fetch(`/api/series/${selectedSeriesId}`)
      const json = await res.json()
      setSeriesIsPublished(json.data?.is_published ?? null)
      if (json.data?.chapters?.length) {
        const numbers: number[] = json.data.chapters.map((c: { chapter_number: number }) => c.chapter_number)
        setExistingNumbers(numbers)
        setChapterNumber(String(Math.max(...numbers) + 1))
      } else {
        setExistingNumbers([])
        setChapterNumber('1')
      }
    }
    fetchNextChapter()
  }, [selectedSeriesId])

  function addFiles(files: File[]) {
    const imgs = keepImageFiles(files)
    if (!imgs.length) return

    const newPages: PageFile[] = imgs.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      error: null,
      isSpread: false,
    }))

    setPages(prev => [...prev, ...newPages])

    newPages.forEach(page => {
      const img = new window.Image()
      img.onload = () => {
        const isSpread = isSpreadPage(img.naturalWidth, img.naturalHeight)
        warnIfOversizedPage(page.file, img.naturalWidth, img.naturalHeight)
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, isSpread } : p))
      }
      img.onerror = () => {
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, error: UNREADABLE_IMAGE_MESSAGE } : p))
        toast.error(`"${page.file.name}": ${UNREADABLE_IMAGE_MESSAGE}`)
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
    // row saved -> uploaded pages already have their numbers on the server
    if (savedChapterId.current) return
    if (!over || active.id === over.id) return
    setPages(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id)
      const newIndex = prev.findIndex(p => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  /**
   * Saves the chapter row as a draft and uploads the pages in order.
   * Same flow as the series wizard: nothing is live until every page is up.
   * The row is a draft in both modes; publishing it later clears is_draft
   * (PATCH /api/chapters/[id]).
   *
   * @param mode - only picks the wording of the error toast
   * @returns the chapter id once every page is uploaded; null if a step failed
   *   (the error is already shown in a toast)
   *
   * Stops at the first failed page: the server numbers pages max + 1, so
   * uploading past a failure would put the later pages in the wrong place.
   * Safe to call again: the saved row and the uploaded pages are skipped.
   */
  async function persist(mode: SaveMode): Promise<string | null> {
    if (!savedChapterId.current) {
      const chRes  = await fetch('/api/chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: selectedSeriesId, chapter_number: chapterNum, title: chapterTitle.trim() || null, is_early_access: isEarlyAccess, is_published: false, is_draft: true, published_at: new Date().toISOString() }),
      })
      const chJson = await chRes.json().catch(() => null) as { data?: { id: string }; error?: string } | null
      if (!chRes.ok || chJson?.error || !chJson?.data) {
        toast.error(chJson?.error ?? 'Failed to create chapter')
        return null
      }
      savedChapterId.current = chJson.data.id
      setChapterSaved(true)
    }
    const chapterId = savedChapterId.current

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      if (!page || page.uploaded) continue
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: true, error: null } : p))
      try {
        await uploadComicPage(chapterId, page.file, page.isSpread)
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: false, uploaded: true, error: null } : p))
      } catch (err) {
        const message = describePageError(i + 1, page.file, err)
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, uploading: false, error: message } : p))
        toast.error(
          `${message} ${mode === 'publish' ? 'Nothing was published; the chapter is saved as a draft.' : 'The chapter is saved as a draft.'} ` +
          'Retry to upload the remaining pages, or remove that page first.',
          { duration: 15_000 }
        )
        return null
      }
    }
    return chapterId
  }

  /**
   * Draft: save + upload, then go to Drafts.
   * Publish: save + upload, then publish the series (if it isn't yet) and the
   * chapter. Publishing is the last step, so a failed upload or a failed
   * publish request leaves a draft and never an empty or half-uploaded chapter.
   */
  async function handleSubmit(mode: SaveMode) {
    if (!selectedSeriesId) { toast.error('Select a series'); return }
    if (!chapterNumber)    { toast.error('Chapter number is required'); return }
    if (!isValidNumber)    { toast.error('Chapter number must be 1 or higher'); return }
    // on a retry the row already holds this number
    if (isDuplicateNumber && !savedChapterId.current) { toast.error(`Chapter ${chapterNum} already exists in this series`); return }
    setSubmitting(true)
    try {
      const chapterId = await persist(mode)
      if (!chapterId) { setSubmitting(false); return }

      if (mode === 'draft') {
        toast.success('Chapter saved as draft')
        router.push('/admin/drafts')
        return
      }

      // every page is up -> go live. series first, then the chapter (same order as the wizard)
      if (seriesIsPublished !== true) await setPublished('series', selectedSeriesId)
      await setPublished('chapters', chapterId)

      toast.success(seriesIsPublished === false ? 'Series published!' : 'Chapter published!')
      router.push('/admin/series')
    } catch (err) {
      // persist() reports its own errors; this is a failed publish request or a network error
      const reason = (err instanceof Error && err.message ? err.message : 'Something went wrong').replace(/[.!?]$/, '')
      toast.error(savedChapterId.current ? `${reason}. The chapter is saved as a draft; try again.` : `${reason}.`)
      setSubmitting(false)
    }
  }

  if (!loadingSeries && seriesList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8 max-md:p-4 animate-page-in">
        <p className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>No series found. Create a series first before adding chapters.</p>
        <Link href="/admin/series/new" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)', border: '1px solid var(--ryu-primary-deep)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Create New Series
          </Link>
      </div>
    )
  }

  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--admin-topbar-h))' }}>

      <div className="flex items-center gap-2 px-8 max-md:px-4 pt-6 pb-3 text-sm font-mono-ryu" style={{ color: 'var(--ryu-text-2)' }}>
        <Link href="/admin/series" style={{ color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>Series</Link>
        <span style={{ color: 'var(--ryu-text-3)' }}>›</span>
        <span style={{ color: 'var(--ryu-text)' }}>New Chapter</span>
      </div>

      <div className="px-8 max-md:px-4 pb-6">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>Add chapter</div>
        <h1 className="font-heading font-bold" style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>New Chapter</h1>
      </div>

      <div className="max-lg:flex-col max-md:px-4! max-md:pb-[calc(10.5rem+env(safe-area-inset-bottom))]!" style={{ display: 'flex', flex: 1, gap: 24, padding: '0 32px 112px' }}>

        <div className="max-lg:flex-none! max-lg:max-w-none!" style={{ flex: 1, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>

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
                <Select value={selectedSeriesId} onValueChange={v => setSelectedSeriesId(v ?? '')} disabled={chapterSaved}>
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
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr]" style={{ gap: 14 }}>
                <div>
                  <label style={labelStyle}>Chapter # <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={chapterNumber}
                    onChange={e => setChapterNumber(e.target.value)}
                    disabled={chapterSaved}
                  />
                  {chapterNumber && !isValidNumber && <p style={{ fontSize: 11.5, color: 'var(--ryu-danger)', marginTop: 4 }}>Must be 1 or higher</p>}
                  {chapterNumber && isValidNumber && isDuplicateNumber && <p style={{ fontSize: 11.5, color: 'var(--ryu-danger)', marginTop: 4 }}>Chapter {chapterNum} already exists</p>}
                </div>
                <div>
                  <label style={labelStyle}>Title <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>(optional)</span></label>
                  <input style={inputStyle} value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} placeholder="e.g. The Beginning" disabled={chapterSaved} />
                </div>
              </div>
              {chapterSaved && (
                <p style={{ fontSize: 11.5, color: 'var(--ryu-text-2)', margin: 0 }}>
                  This chapter is saved as a draft, so its details are locked here. Finish the upload, or edit it later from Drafts.
                </p>
              )}
            </div>
          </div>

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
                  ? <CheckCircle2 size={13} style={{ color: 'var(--ryu-success)', flexShrink: 0 }} />
                  : <Circle      size={13} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}>{item.label}</span>
              </div>
            ))}
          </div>

        </div>

        <div className="flex flex-col gap-4 max-lg:flex-none! max-lg:self-stretch! max-lg:static!" style={{ flex: 1, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ryu-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>02</span>
                <span className="font-heading" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ryu-text)' }}>Pages</span>
              </div>
              <span className="font-mono-ryu text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--ryu-accent)', color: 'var(--ryu-on-accent)' }}>Required</span>
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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] md:grid-cols-[repeat(5,1fr)]" style={{ gap: 8, marginBottom: 10 }}>
                      {pages.map((page, idx) => (
                        <SortablePageThumbnail key={page.id} page={page} index={idx} onRemove={removePage} locked={chapterSaved} />
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
                {chapterSaved ? 'Page order is locked once saving starts · reorder later from the edit page' : (
                  <>
                    <span className="max-md:hidden">Drag to reorder · upload in reading order</span>
                    <span className="md:hidden">Press and hold a page, then drag to reorder</span>
                  </>
                )}
              </div>
            </div>
          </div>


        </div>

      </div>

      <div className="action-bar" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to top, var(--background) 60%, transparent)', padding: '20px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <button
          disabled={submitting}
          onClick={() => router.push('/admin/series')}
          aria-label="Discard"
          className="action-icon"
          style={{
            fontSize: 13.5, fontWeight: 600,
            color: submitting ? 'var(--ryu-text-3)' : 'var(--ryu-danger)',
            background: 'none', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 0, opacity: submitting ? 0.5 : 1,
            transition: 'color 150ms, opacity 150ms',
          }}
        >
          <Trash2 size={18} className="md:hidden" aria-hidden="true" /><span className="max-md:hidden">Discard</span>
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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-primary-deep)', background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 0 color-mix(in srgb, var(--ryu-shadow) 6%, transparent)', opacity: (!hasSeriesSelected || !hasChapterNumber || !hasPages || !isValidNumber || isDuplicateNumber) ? 0.5 : 1 }}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {seriesIsPublished === false ? 'Publish series' : 'Publish chapter'}
          </button>
        </div>
      </div>

    </div>
  )
}