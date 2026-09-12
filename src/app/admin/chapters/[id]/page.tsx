'use client'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Circle } from 'lucide-react'
import PageUploader from '../../PageUploader'
import type { Tables } from '@/types/database'

type Chapter = Tables<'chapters'>
type Page    = Tables<'pages'>

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

export default function EditChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()

  const [chapter,         setChapter]         = useState<Chapter | null>(null)
  const [chapterNumber,   setChapterNumber]   = useState('')
  const [title,           setTitle]           = useState('')
  const [isEarlyAccess,   setIsEarlyAccess]   = useState(false)
  const [publishedAt,     setPublishedAt]     = useState('')
  const [loading,         setLoading]         = useState(false)
  const [fetching,        setFetching]        = useState(true)
  const [deleteOpen,      setDeleteOpen]      = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [chapterId,       setChapterId]       = useState<string | null>(null)
  const [pages,           setPages]           = useState<Page[]>([])
  const [seriesPublished, setSeriesPublished] = useState(false)

  useEffect(() => {
    async function init() {
      const { id } = await params
      setChapterId(id)
      try {
        const res  = await fetch(`/api/chapters/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to fetch chapter')
        const c: Chapter = data.data
        setChapter(c)
        setChapterNumber(String(c.chapter_number))
        setTitle(c.title ?? '')
        setIsEarlyAccess(c.is_early_access ?? false)
        setPublishedAt(c.published_at ? new Date(c.published_at).toISOString().slice(0, 16) : '')
        setPages((c as unknown as { pages?: Page[] }).pages ?? [])
        setSeriesPublished((c as unknown as { series?: { is_published: boolean | null } }).series?.is_published ?? false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally { setFetching(false) }
    }
    init()
  }, [params])

  async function handleSubmit() {
    if (!chapterId) return
    setError(null); setLoading(true)
    try {
      const res  = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_number: Number(chapterNumber),
          title: title.trim() || null,
          is_early_access: isEarlyAccess,
          published_at: publishedAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      router.push('/admin/chapters')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  async function handleDelete() {
    if (!chapterId) return
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete chapter')
      router.push('/admin/chapters')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong ')
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map(n => (
          <div key={n} className="h-16 rounded-xl animate-pulse"
            style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />
        ))}
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="p-8 text-sm" style={{ color: '#DC2626' }}>
        Chapter not found.
      </div>
    )
  }

  const pagesOrderedCorrectly = pages.length > 0 &&
    [...pages]
      .sort((a, b) => a.page_number - b.page_number)
      .every((p, i) => p.page_number === i + 1)

  const checklist = [
    { label: 'Chapter # set',                          done: Number(chapterNumber) > 0 },
    { label: 'At least 1 page uploaded',                done: pages.length > 0 },
    { label: 'Pages named/ordered correctly',           done: pagesOrderedCorrectly },
    { label: 'Publish date set',                        done: publishedAt.trim().length > 0 },
    { label: 'Parent series is published',              done: seriesPublished },
  ]
  const checklistDone = checklist.filter(c => c.done).length

  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-8 pt-6 pb-3 text-sm font-mono-ryu"
        style={{ color: 'var(--ryu-text-2)' }}>
        <Link href="/admin/chapters" style={{ color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>
          Chapters
        </Link>
        <span style={{ color: 'var(--ryu-text-3)' }}>›</span>
        <span style={{ color: 'var(--ryu-text)' }}>Edit</span>
      </div>

      {/* ── Page heading ────────────────────────────────────────────────── */}
      <div className="px-8 pb-6">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
          style={{ color: 'var(--ryu-primary-deep)' }}>
          Edit chapter
        </div>
        <h1 className="font-heading font-bold"
          style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>
          Chapter {chapter.chapter_number}
        </h1>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-8 mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Main two-column grid ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, gap: 24, padding: '0 32px 112px' }}>

        {/* ── LEFT COLUMN — Chapter details ────────────────────────────── */}
        <div style={{ flex: 1, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 01 Chapter details card */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18, paddingBottom: 10, borderBottom: '1px dashed var(--ryu-border)' }}>
              <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>01</span>
              <span className="font-heading" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ryu-text)' }}>Chapter details</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Chapter number + Title side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>
                    Chapter # <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    value={chapterNumber}
                    onChange={e => setChapterNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Title{' '}
                    <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>
                      (optional)
                    </span>
                  </label>
                  <input
                    style={inputStyle}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. The Beginning"
                  />
                </div>
              </div>

              {/* Publish date */}
              <div>
                <label style={labelStyle}>Publish Date</label>
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={publishedAt}
                  onChange={e => setPublishedAt(e.target.value)}
                />
              </div>

            </div>
          </div>

          {/* Checklist card */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase" style={{ color: 'var(--ryu-text-2)' }}>Checklist</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', border: '1px solid var(--ryu-border)' }}>
                {checklistDone} / {checklist.length}
              </span>
            </div>
            {checklist.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                {item.done
                  ? <CheckCircle2 size={13} style={{ color: 'var(--ryu-success, #16A34A)', flexShrink: 0 }} />
                  : <Circle       size={13} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* 02 Early Access card */}
          {process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true' && (
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 2 }}>
                  Early access only
                  {isEarlyAccess && (
                    <span style={{ marginLeft: 8, fontSize: 10.5, background: 'var(--ryu-accent)', color: '#713F12', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      EA
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ryu-text-2)' }}>
                  Only subscribers can read this chapter
                </p>
              </div>
            
              {/* Custom toggle — matches new chapter page */}
              <button
                type="button"
                role="switch"
                aria-checked={isEarlyAccess}
                onClick={() => setIsEarlyAccess(!isEarlyAccess)}
                style={{
                  width: 40, height: 22, borderRadius: 99,
                  background: isEarlyAccess ? 'var(--ryu-primary)' : 'var(--ryu-border)',
                  border: 'none', position: 'relative', cursor: 'pointer',
                  flexShrink: 0, transition: 'background 200ms ease',
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: isEarlyAccess ? 19 : 2,
                  top: 2, width: 16, height: 16, borderRadius: 99,
                  background: '#fff', transition: 'left 200ms ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                }} />
              </button>
            </div>
          </div>
          )}
          
        </div>
        {/* ── END LEFT COLUMN ──────────────────────────────────────────── */}

        {/* ── RIGHT COLUMN — Pages ─────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4"
          style={{ flex: 1, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ryu-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>02</span>
                <span className="font-heading" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ryu-text)' }}>Pages</span>
              </div>
              <span className="font-mono-ryu text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-2)', border: '1px solid var(--ryu-border)' }}>
                Drag to reorder
              </span>
            </div>

            {/* PageUploader lives here now */}
            <div style={{ padding: 16 }}>
              <PageUploader
                chapterId={chapterId ?? ''}
                initialPages={chapter ? (chapter as unknown as { pages?: Page[] }).pages ?? [] : []}
                onPagesChange={setPages}
              />
            </div>

          </div>
        </div>
        {/* ── END RIGHT COLUMN ─────────────────────────────────────────── */}

      </div>

      {/* ── Fixed bottom action bar ──────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to top, var(--background) 60%, transparent)',
          padding: '20px 32px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Left — destructive */}
            <AlertDialogTrigger
              disabled={loading}
              style={{
                fontSize: 13.5, fontWeight: 600, color: '#DC2626',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              Delete chapter
            </AlertDialogTrigger>

          {/* Right — cancel + save */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/chapters">
              <button
                style={{
                  padding: '10px 18px', borderRadius: 8,
                  border: '1px solid var(--ryu-border)',
                  background: 'var(--ryu-surface-1)',
                  color: 'var(--ryu-text)',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Link>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid var(--ryu-primary-deep)',
                background: 'var(--ryu-primary)',
                color: '#fff', fontSize: 13.5, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter {chapter?.chapter_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the chapter and all its pages from R2. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}