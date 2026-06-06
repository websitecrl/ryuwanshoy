'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import WizardHeader from './WizardHeader'
import Step1 from './step1'
import Step2 from './step2'
import Step3 from './step3'
import { type SeriesFormData, type LocalPage } from './types'

// ── Default form state ─────────────────────────────────────────────────────

const DEFAULT_FORM: SeriesFormData = {
  title: '', slug: '', description: '',
  genre: 'Action', status: 'ongoing', isEA: false,
  coverFile: null, coverPreview: null,
  bannerFile: null, bannerPreview: null,
}

// ── Wizard shell ───────────────────────────────────────────────────────────

function WizardShell() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [step,      setStep]      = useState(() => parseInt(searchParams.get('step') ?? '1'))
  const [seriesId,  setSeriesId]  = useState(() => searchParams.get('series_id')  ?? '')
  const [chapterId, setChapterId] = useState(() => searchParams.get('chapter_id') ?? '')

  // Step 1 form — lifted so data persists when going back
  const [formData, setFormData] = useState<SeriesFormData>(DEFAULT_FORM)

  // Step 2 pages — lifted so Step 3 can show the real preview
  const [uploadedPages, setUploadedPages] = useState<LocalPage[]>([])

  function patchForm(patch: Partial<SeriesFormData>) {
    setFormData(prev => ({ ...prev, ...patch }))
  }

  // ── On refresh at step 2 or 3 — series already saved, send to drafts ────
  useEffect(() => {
    const urlStep     = parseInt(searchParams.get('step') ?? '1')
    const urlSeriesId = searchParams.get('series_id') ?? ''

    if (urlStep > 1 && urlSeriesId) {
      toast.success('Your work is saved — find it in drafts')
      router.replace('/admin/drafts')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync URL silently on every step change — no page reload ─────────────
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('step', String(step))
    if (seriesId)  params.set('series_id',  seriesId)
    if (chapterId) params.set('chapter_id', chapterId)
    router.replace(`/admin/series/new?${params.toString()}`, { scroll: false })
  }, [step, seriesId, chapterId, router])

  function goToStep2(newSeriesId: string) {
    setSeriesId(newSeriesId)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStep3(newChapterId: string, pages: LocalPage[]) {
    setChapterId(newChapterId)
    setUploadedPages(pages)
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack(toStep: number) {
    setStep(toStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <WizardHeader step={step} seriesTitle={formData.title} />

      {step === 1 && (
        <Step1
          data={formData}
          onChange={patchForm}
          onNext={goToStep2}
          existingSeriesId={seriesId || undefined}
        />
      )}

      {step === 2 && (
        <Step2
          seriesId={seriesId}
          seriesTitle={formData.title}
          existingChapterId={chapterId || undefined}
          initialPages={uploadedPages}
          onBack={() => goBack(1)}
          onNext={goToStep3}
        />
      )}

      {step === 3 && (
        <Step3
          seriesId={seriesId}
          seriesData={formData}
          chapterId={chapterId}
          uploadedPages={uploadedPages}
          onBack={() => goBack(2)}
        />
      )}
    </div>
  )
}

// ── Default export — Suspense required for useSearchParams ─────────────────

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