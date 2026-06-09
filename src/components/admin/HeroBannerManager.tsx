'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Trash2, Plus, GripVertical, Search, X, Monitor } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

type HeroSlide = {
  id: string
  headline: string | null
  banner_image: string | null
  is_visible: boolean | null
  order_index: number
  series_id: string | null
  chapter_id: string | null
  series: { title: string; slug: string } | null
}

type SeriesSummary = {
  id: string
  title: string
  slug: string
  cover_image: string | null
}

export default function HeroBannerManager() {
  const [slides, setSlides]           = useState<HeroSlide[]>([])
  const [seriesList, setSeriesList]   = useState<SeriesSummary[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [showForm, setShowForm]       = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [previewSlide, setPreviewSlide] = useState<HeroSlide | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Form fields
  const [seriesSearch, setSeriesSearch]       = useState('')
  const [seriesDropOpen, setSeriesDropOpen]   = useState(false)
  const [selectedSeries, setSelectedSeries]   = useState<SeriesSummary | null>(null)
  const [newHeadline, setNewHeadline]         = useState('')
  const [newImageFile, setNewImageFile]       = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState('')
  const [creating, setCreating]               = useState(false)
  const [createError, setCreateError]         = useState<string | null>(null)

  const fetchSlides = useCallback(async () => {
    try {
      const res  = await fetch('/api/hero-slides')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch slides')
      setSlides(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSeries = useCallback(async () => {
    try {
      const res  = await fetch('/api/series')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch series')
      setSeriesList(data)
    } catch (err) {
      console.error('Failed to fetch series:', err)
    }
  }, [])

  useEffect(() => {
    fetchSlides()
    fetchSeries()
  }, [fetchSlides, fetchSeries])

  const filteredSeries = seriesList.filter(s =>
    s.title.toLowerCase().includes(seriesSearch.toLowerCase())
  )

  async function handleToggleVisible(slide: HeroSlide) {
    setActioningId(slide.id)
    try {
      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slide, is_visible: !slide.is_visible }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update slide')
      setSlides(prev =>
        prev.map(s => s.id === slide.id ? { ...s, is_visible: !s.is_visible } : s)
      )
    } catch (err) {
      console.error(err)
    } finally {
      setActioningId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    setActioningId(id)
    try {
      const res = await fetch(`/api/hero-slides/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete slide')
      setSlides(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setActioningId(null)
    }
  }

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)

    try {
      let imageUrl = ''

      if (newImageFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(newImageFile)
        })
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, folder: 'hero-banners' }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')
        imageUrl = uploadData.url
      }

      const res = await fetch('/api/hero-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_id:    selectedSeries?.id ?? null,
          headline:     newHeadline || null,
          banner_image: imageUrl || null,
          is_visible:   false,
          order_index:  slides.length,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create slide')

      await fetchSlides()
      setShowForm(false)
      setSelectedSeries(null)
      setSeriesSearch('')
      setNewHeadline('')
      setNewImageFile(null)
      setNewImagePreview('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>
          Max 5 slides. Only visible slides show on the site.
        </p>
        {slides.length < 5 && (
          <button
            onClick={() => { setShowForm(p => !p); setCreateError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-100"
            style={{
              background: showForm ? 'var(--ryu-surface-3)' : 'var(--ryu-surface-2)',
              border: '1px solid var(--ryu-border)',
              color: 'var(--ryu-text)',
            }}
          >
            {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Slide</>}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--ryu-text)' }}>New Slide</div>

          {createError && (
            <div className="rounded-lg px-4 py-3 text-sm"
              style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
              {createError}
            </div>
          )}

          {/* Series search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--ryu-text)' }}>
              Series
              <span className="ml-1 font-normal" style={{ color: 'var(--ryu-text-3)' }}>(optional)</span>
            </label>
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--ryu-surface-1)', border: `1px solid ${seriesDropOpen ? 'var(--ryu-primary)' : 'var(--ryu-border)'}` }}>
                <Search size={14} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={selectedSeries ? selectedSeries.title : seriesSearch}
                  onChange={e => { setSeriesSearch(e.target.value); setSelectedSeries(null); setSeriesDropOpen(true) }}
                  onFocus={() => setSeriesDropOpen(true)}
                  placeholder="Search series..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: 'var(--ryu-text)' }}
                />
                {selectedSeries && (
                  <button onClick={() => { setSelectedSeries(null); setSeriesSearch('') }}
                    style={{ color: 'var(--ryu-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {seriesDropOpen && !selectedSeries && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20 max-h-48 overflow-y-auto"
                  style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)' }}>
                  {filteredSeries.length === 0
                    ? <div className="px-3 py-3 text-sm" style={{ color: 'var(--ryu-text-3)' }}>No series found</div>
                    : filteredSeries.map(s => (
                      <button key={s.id}
                        onClick={() => { setSelectedSeries(s); setSeriesSearch(''); setSeriesDropOpen(false) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm cursor-pointer"
                        style={{ background: 'none', border: 'none', color: 'var(--ryu-text)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                      >
                        {s.cover_image
                          ? <img src={s.cover_image} alt={s.title} className="w-8 h-8 rounded object-cover shrink-0" />
                          : <div className="w-8 h-8 rounded shrink-0" style={{ background: 'var(--ryu-surface-3)' }} />
                        }
                        {s.title}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--ryu-text)' }}>Headline</label>
            <input type="text" value={newHeadline} onChange={e => setNewHeadline(e.target.value)}
              placeholder="e.g. New chapter out now!"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', color: 'var(--ryu-text)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--ryu-primary)'; setSeriesDropOpen(false) }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--ryu-border)' }}
            />
          </div>

          {/* Banner image upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--ryu-text)' }}>
              Banner Image
              <span className="ml-2 font-normal" style={{ color: 'var(--ryu-text-3)' }}>1920 × 1080 recommended</span>
            </label>
            {newImagePreview && (
              <div className="relative w-full rounded-lg overflow-hidden"
                style={{ height: 160, border: '1px solid var(--ryu-border)' }}>
                <img src={newImagePreview} alt="Banner preview" className="w-full h-full object-cover" />
                <button onClick={() => { setNewImageFile(null); setNewImagePreview('') }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none' }}>
                  <X size={14} />
                </button>
              </div>
            )}
            {!newImagePreview && (
              <label className="flex flex-col items-center justify-center w-full rounded-lg cursor-pointer transition-colors duration-150"
                style={{ height: 120, border: '2px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--ryu-primary-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-1)' }}>
                <Plus size={20} style={{ color: 'var(--ryu-text-3)', marginBottom: 6 }} />
                <span className="text-sm" style={{ color: 'var(--ryu-text-2)' }}>Click to upload banner image</span>
                <span className="text-xs mt-1" style={{ color: 'var(--ryu-text-3)' }}>PNG, JPG, WEBP up to 25MB</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setNewImageFile(file)
                    setNewImagePreview(URL.createObjectURL(file))
                  }} />
              </label>
            )}
          </div>

          {/* Site preview */}
          {(newImagePreview || selectedSeries) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--ryu-text-2)' }}>
                <Monitor size={13} /> Site Preview
              </div>
              <div className="relative w-full rounded-lg overflow-hidden flex items-end"
                style={{ height: 140, background: newImagePreview ? `url(${newImagePreview}) center/cover` : 'linear-gradient(135deg, #1C1917, #44170A)' }}>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                <div className="relative px-4 pb-4">
                  {newHeadline && <div className="text-white font-bold text-lg leading-tight">{newHeadline}</div>}
                  {selectedSeries && <div className="text-white/70 text-sm mt-0.5">{selectedSeries.title}</div>}
                </div>
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            style={{ background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)' }}>
            {creating ? 'Creating…' : 'Create Slide'}
          </button>
        </div>
      )}

      {loading && <div className="text-sm" style={{ color: 'var(--ryu-text-3)' }}>Loading slides…</div>}

      {!loading && slides.length === 0 && (
        <div className="rounded-xl px-6 py-12 text-center text-sm"
          style={{ background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)', color: 'var(--ryu-text-3)' }}>
          No slides yet. Add one to get started.
        </div>
      )}

      {/* Slides list */}
      <div className="space-y-3">
        {slides.map(slide => (
          <div key={slide.id} className="flex items-center gap-4 rounded-xl p-4"
            style={{ background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
            <GripVertical size={18} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />

            {/* Thumbnail */}
            <div className="relative shrink-0 rounded-lg overflow-hidden"
              style={{ width: 112, height: 56, background: 'var(--ryu-surface-3)', border: '1px solid var(--ryu-border)' }}>
              {slide.banner_image
                ? <img src={slide.banner_image} alt={slide.headline ?? 'Slide'} className="w-full h-full object-cover" />
                : <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--ryu-text-3)' }}>No image</div>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ryu-text)' }}>
                {slide.headline ?? '(No headline)'}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ryu-text-2)' }}>
                {slide.series?.title ?? 'No series linked'}
              </p>
            </div>

            {/* Visible badge */}
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
              style={slide.is_visible
                ? { background: '#DCFCE7', color: '#15803D' }
                : { background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-3)', border: '1px solid var(--ryu-border)' }}>
              {slide.is_visible ? 'Visible' : 'Hidden'}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">

              {/* Preview */}
              <button
                onClick={() => setPreviewSlide(previewSlide?.id === slide.id ? null : slide)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-100"
                style={{
                  background: previewSlide?.id === slide.id ? 'var(--ryu-primary-soft)' : 'transparent',
                  border: '1px solid transparent',
                  color: previewSlide?.id === slide.id ? 'var(--ryu-primary-deep)' : 'var(--ryu-text-3)',
                }}
                title="Preview"
              >
                <Monitor size={15} />
              </button>

              {/* Toggle visible */}
              <button
                onClick={() => handleToggleVisible(slide)}
                disabled={actioningId === slide.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-100 disabled:opacity-50"
                style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--ryu-text-3)' }}
                title={slide.is_visible ? 'Hide' : 'Show'}
              >
                {slide.is_visible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>

              {/* Delete — AlertDialog, trigger styled directly */}
              <AlertDialog
                open={pendingDeleteId === slide.id}
                onOpenChange={open => { if (!open) setPendingDeleteId(null) }}
              >
                <AlertDialogTrigger
                  disabled={actioningId === slide.id}
                  onClick={() => setPendingDeleteId(slide.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-100 disabled:opacity-50"
                  style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--ryu-text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ryu-text-3)'}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this slide?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {slide.headline
                        ? <>The slide "<strong>{slide.headline}</strong>" will be permanently removed.</>
                        : 'This slide will be permanently removed.'
                      } This cannot be undone.
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
          </div>
        ))}

        {/* Inline preview panel */}
        {previewSlide && (
          <div className="relative w-full rounded-xl overflow-hidden flex items-end"
            style={{
              height: 320,
              background: previewSlide.banner_image
                ? `url(${previewSlide.banner_image}) center/cover`
                : 'linear-gradient(135deg, #1C1917, #44170A)',
              border: '1px solid var(--ryu-border)',
            }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }} />
            <div className="relative px-6 pb-5">
              {previewSlide.headline && <div className="text-white font-bold text-xl leading-tight">{previewSlide.headline}</div>}
              {previewSlide.series && <div className="text-white/70 text-sm mt-1">{previewSlide.series.title}</div>}
            </div>
            <button onClick={() => setPreviewSlide(null)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none' }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}