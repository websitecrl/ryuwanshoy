'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import WizardHeader from './WizardHeader'
import Step1 from './step1'
import Step2 from './step2'
import Step3 from './step3'
import { type SeriesFormData, type LocalPage, type SaveState } from './types'
import { createSeries, createChapter, uploadPage, setPublished } from './save'

// ── Default form state ─────────────────────────────────────────────────────

const DEFAULT_FORM: SeriesFormData = {
  title: '', slug: '', description: '',
  genre: 'Action', status: 'ongoing', isEA: false,
  coverFile: null, coverPreview: null,
  bannerFile: null, bannerPreview: null,
  minAge: 13,
}

// ── Wizard shell ───────────────────────────────────────────────────────────
//
// Nothing is written to the DB while you move between steps — only "Save as
// draft" or "Publish" create rows, so in-progress work never shows up as a
// draft. Once rows exist their ids are kept here, so a retry after a failed
// upload reuses them instead of creating duplicates.

function WizardShell() {
  const router = useRouter()

  // Wizard state lives in memory only, so a refresh always starts over at
  // step 1 (the beforeunload warning below guards against losing it).
  const [step, setStep] = useState(1)

  // Step 1 form — lifted so data persists when going back
  const [formData, setFormData] = useState<SeriesFormData>(DEFAULT_FORM)

  // Step 2 chapter title + pages — lifted so they survive going back, and so
  // Step 3 can show the real preview and each page's upload status
  const [chapterTitle, setChapterTitle] = useState('')
  const [pages,        setPages]        = useState<LocalPage[]>([])

  // Rows created by a save so far. A ref so a running save always sees the
  // latest ids; hasSavedRows mirrors it for rendering.
  const savedIds = useRef<{ seriesId?: string; chapterId?: string }>({})
  const [hasSavedRows, setHasSavedRows] = useState(false)
  const [saving,       setSaving]       = useState<SaveState>(null)

  // Set right before a deliberate navigation so beforeunload stays quiet.
  const leaving = useRef(false)

  function patchForm(patch: Partial<SeriesFormData>) {
    setFormData(prev => ({ ...prev, ...patch }))
  }

  function patchPage(id: string, patch: Partial<LocalPage>) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  // ── Warn before closing/refreshing while there's unsaved work ───────────
  const hasWork = formData.title.trim() !== '' || chapterTitle.trim() !== '' || pages.length > 0
  useEffect(() => {
    if (!hasWork) return
    function warn(e: BeforeUnloadEvent) {
      if (leaving.current) return
      e.preventDefault()
      e.returnValue = '' // still required by some browsers to show the prompt
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasWork])

  // ── Sync URL silently on every step change — no page reload ─────────────
  useEffect(() => {
    router.replace(`/admin/series/new?step=${step}`, { scroll: false })
  }, [step, router])

  function goToStep(n: number) {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function leaveTo(url: string) {
    leaving.current = true
    window.location.href = url
  }

  /**
   * Creates whatever isn't saved yet: the series, then (withChapter) chapter 1
   * and every page not yet uploaded, one by one in reading order. Stops at the
   * first failed page: the API appends pages, so carrying on past a failure
   * would put the retried page out of order.
   *
   * @returns true when everything asked for is saved
   */
  async function persist(kind: 'draft' | 'publish', withChapter: boolean): Promise<boolean> {
    const ids = savedIds.current
    setSaving({ kind, page: null })
    try {
      if (!ids.seriesId) {
        ids.seriesId = await createSeries(formData)
        setHasSavedRows(true)
      }
      if (!withChapter) return true

      if (!ids.chapterId) ids.chapterId = await createChapter(ids.seriesId, chapterTitle)

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        if (!page || page.uploaded) continue
        setSaving({ kind, page: { current: i + 1, total: pages.length } })
        patchPage(page.id, { uploading: true, error: null })
        const ok = await uploadPage(ids.chapterId, page)
        patchPage(page.id, { uploading: false, uploaded: ok, error: ok ? null : 'Upload failed' })
        if (!ok) {
          toast.error(`Page ${i + 1} failed to upload. Nothing was published. Retry to upload the remaining pages.`)
          return false
        }
      }
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      return false
    }
  }

  /** "Save as draft" from any step: creates the unpublished rows now, then opens Drafts. */
  async function saveDraft(withChapter: boolean) {
    const ok = await persist('draft', withChapter)
    if (ok) {
      toast.success(withChapter ? 'Series and chapter saved as draft' : 'Series saved as draft')
      leaveTo('/admin/drafts')
      return
    }
    setSaving(null)
    // A chapter save that got partway lands on Step 3, where failed pages are
    // listed and Publish / Save as draft retry them.
    if (withChapter && savedIds.current.seriesId) goToStep(3)
  }

  /** Saves everything, and only once every page is uploaded flips both rows live. */
  async function publish() {
    const ok = await persist('publish', true)
    const { seriesId, chapterId } = savedIds.current
    if (!ok || !seriesId || !chapterId) { setSaving(null); return }

    try {
      await setPublished('series', seriesId)
      await setPublished('chapters', chapterId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed')
      setSaving(null)
      return
    }

    toast.success(`"${formData.title}" is now live!`)
    leaving.current = true
    router.replace('/admin/series')
  }

  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <WizardHeader step={step} seriesTitle={formData.title} />

      {step === 1 && (
        <Step1
          data={formData}
          onChange={patchForm}
          saving={saving}
          onNext={() => goToStep(2)}
          onSaveDraft={() => saveDraft(false)}
        />
      )}

      {step === 2 && (
        <Step2
          chapterTitle={chapterTitle}
          onChapterTitleChange={setChapterTitle}
          pages={pages}
          setPages={setPages}
          saving={saving}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
          onSaveDraft={() => saveDraft(true)}
        />
      )}

      {step === 3 && (
        <Step3
          seriesData={formData}
          uploadedPages={pages}
          saving={saving}
          hasSavedRows={hasSavedRows}
          onBack={() => goToStep(2)}
          onSaveDraft={() => saveDraft(true)}
          onPublish={publish}
        />
      )}

      {saving && <SavingOverlay saving={saving} />}
    </div>
  )
}

// ── Saving overlay — covers the whole wizard so nothing can be clicked twice ─

function SavingOverlay({ saving }: { saving: NonNullable<SaveState> }) {
  const { page } = saving
  const percent = page ? Math.round(((page.current - 1) / page.total) * 100) : 0

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="saving-overlay-title"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'color-mix(in srgb, var(--ryu-ink) 55%, transparent)' }}
    >
      <div style={{ width: '100%', maxWidth: 340, padding: '24px 28px', borderRadius: 12, background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', textAlign: 'center' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ryu-primary)', margin: '0 auto 12px' }} />
        <p id="saving-overlay-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ryu-text)', marginBottom: 4 }}>
          {saving.kind === 'publish' ? 'Publishing your series' : 'Saving draft'}
        </p>
        <p aria-live="polite" style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: page ? 12 : 0 }}>
          {page ? `Uploading page ${page.current}/${page.total}` : 'Saving series details...'}
        </p>
        {page && (
          <div style={{ height: 6, borderRadius: 99, background: 'var(--ryu-surface-3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${percent}%`, background: 'var(--ryu-primary)', transition: 'width 200ms ease' }} />
          </div>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--ryu-text-3)', marginTop: 12 }}>Keep this tab open until it finishes.</p>
      </div>
    </div>
  )
}

// ── Default export ─────────────────────────────────────────────────────────

export default function NewSeriesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ryu-primary)' }} />
      </div>
    }>
      <WizardShell />
    </Suspense>
  )
}
