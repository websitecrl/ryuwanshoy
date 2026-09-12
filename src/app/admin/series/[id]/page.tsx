'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Plus, CheckCircle2, Circle } from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Tables } from '@/types/database'
import { GENRES } from '../new/types'
import { compressImage } from '@/lib/image-compress'

type Series = Tables<'series'>

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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 22 }}>
      {children}
    </div>
  )
}

function CardLabel({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '1px dashed var(--ryu-border)' }}>
      <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', letterSpacing: 1, fontWeight: 600 }}>{n}</span>
      <span className="font-heading" style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2, color: 'var(--ryu-text)' }}>{title}</span>
    </div>
  )
}

export default function EditSeriesPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [title,       setTitle]       = useState('')
  const [slug,        setSlug]        = useState('')
  const [description, setDescription] = useState('')
  const [genre,       setGenre]       = useState('')
  const [status,      setStatus]      = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing')
  const [minAge,      setMinAge]      = useState<number>(0)

  const [currentCover, setCurrentCover] = useState<string | null>(null)
  const [coverFile,    setCoverFile]    = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function fetchSeries() {
      const res  = await fetch(`/api/series/${id}`)
      const json = await res.json()
      if (json.error || !json.data) { toast.error('Series not found'); router.push('/admin/series'); return }
      const s: Series = json.data
      setTitle(s.title); setSlug(s.slug)
      setDescription(s.description ?? ''); setGenre(s.genre ?? '')
      setStatus((s.status as 'ongoing' | 'completed' | 'hiatus') ?? 'ongoing')
      setMinAge(s.min_age && s.min_age > 0 ? s.min_age : 13)
      setCurrentCover(s.cover_image)
      setLoading(false)
    }
    if (id) fetchSeries()
  }, [id, router])

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!slug.trim())  { toast.error('Slug is required');  return }
    setSubmitting(true)

    let coverImageBase64: string | undefined
    try {
      if (coverFile) coverImageBase64 = await compressImage(coverFile, { maxDimension: 1280 })
    } catch { toast.error('Failed to process images'); setSubmitting(false); return }

    const res  = await fetch(`/api/series/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(), slug: slug.trim().toLowerCase(),
        description: description || null, genre: genre || null, status,
        min_age: minAge,
        ...(coverImageBase64 && { coverImageBase64 }),
      }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); setSubmitting(false) }
    else { toast.success('Series updated!'); router.push('/admin/series') }
  }

  const activeCover = coverPreview ?? currentCover

  const checklist = [
    { label: 'Title set',      done: title.trim().length > 0 },
    { label: 'Slug set',       done: slug.trim().length > 0 },
    { label: 'Genre set',      done: genre.trim().length > 0 },
    { label: 'Cover uploaded', done: !!activeCover },
  ]

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3,4].map(n => (
          <div key={n} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="animate-page-in px-8 pb-28 pt-6" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="mb-8">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2 flex items-center gap-2" style={{ color: 'var(--ryu-primary-deep)' }}>
          <Link href="/admin/series" style={{ color: 'var(--ryu-primary-deep)' }}>Series</Link>
          <span style={{ color: 'var(--ryu-text-3)' }}>›</span>
          <span>Edit</span>
        </div>
        <h1 className="font-heading font-bold" style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>
          Edit Series
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-6 max-w-8xl" style={{ alignItems: 'flex-start' }}>

          {/* LEFT — series info */}
          <div className="flex-1 space-y-5">

            {/* 01 Title & link */}
            <Card>
              <CardLabel n="01" title="Title & link" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Title <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                  <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="My Awesome Comic" />
                </div>
                <div>
                  <label style={labelStyle}>Slug <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                  <input style={inputStyle} value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-awesome-comic" />
                  <p style={{ fontSize: 11.5, color: 'var(--ryu-text-3)', marginTop: 6 }}>
                    ryuwanshoy.com/comics/<strong style={{ color: 'var(--ryu-primary-deep)' }}>{slug || '...'}</strong>
                  </p>
                </div>
              </div>
            </Card>

            {/* 02 Story */}
            <Card>
              <CardLabel n="02" title="Story" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Description <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ryu-text-3)' }}>optional</span></label>
                  <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="A two-line synopsis..." />
                </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Genre</label>
                      <select style={inputStyle} value={genre} onChange={e => setGenre(e.target.value)}>
                        <option value="">Select genre</option>
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="hiatus">Hiatus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label style={labelStyle}>Age rating</label>
                      <select style={inputStyle} value={String(minAge)} onChange={e => setMinAge(Number(e.target.value))}>
                        <option value="13">13+</option>
                        <option value="16">16+</option>
                        <option value="18">18+</option>
                      </select>
                    </div>
                  </div>
              </div>
            </Card>

          </div>

          {/* RIGHT — 03 Artwork unified card, sticky */}
          <div className="w-80 shrink-0" style={{ alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
            <Card>
              <CardLabel n="03" title="Artwork" />
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

              {/* Cover uploader */}
              <label style={{ ...labelStyle, marginBottom: 8 }}>
                Cover <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                <span style={{ float: 'right', fontSize: 10.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>460 × 640 px</span>
              </label>
              {activeCover ? (
                <div style={{ borderRadius: 10, border: '2px solid var(--ryu-primary)', overflow: 'hidden', background: 'var(--ryu-primary-soft)' }}>
                  <div style={{ position: 'relative', width: '100%', maxHeight: 220, overflow: 'hidden' }}>
                    <Image src={activeCover} alt="Cover" fill className="object-cover" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '10px 12px' }}>
                    <button type="button" onClick={() => coverInputRef.current?.click()}
                      style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', cursor: 'pointer' }}>
                      Replace
                    </button>
                    <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); setCurrentCover(null) }}
                      style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => coverInputRef.current?.click()}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-2)', cursor: 'pointer', textAlign: 'center', gap: 8, aspectRatio: '460/640', width: '100%' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImagePlus size={17} />
                  </span>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ryu-text)' }}>Upload cover</p>
                  <p style={{ fontSize: 11, color: 'var(--ryu-text-3)' }}>460 × 640 px portrait</p>
                </div>
              )}

              {/* URL preview */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--ryu-border)' }}>
                <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-2" style={{ color: 'var(--ryu-text-2)' }}>URL preview</div>
                <div style={{ background: 'var(--ryu-surface-3)', borderRadius: 8, padding: '9px 12px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: 12, wordBreak: 'break-all', border: '1px solid var(--ryu-border)' }}>
                  <span style={{ color: 'var(--ryu-text-3)' }}>ryuwanshoy.com/comics/</span>
                  <span style={{ color: 'var(--ryu-primary-deep)', fontWeight: 700 }}>{slug || '...'}</span>
                </div>
              </div>

              {/* Checklist */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--ryu-border)' }}>
                <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-2" style={{ color: 'var(--ryu-text-2)' }}>Checklist</div>
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
            </Card>
          </div>
        </div>

        {/* Bottom action bar */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to top, var(--ryu-bg, var(--background)) 80%, transparent)',
          padding: '16px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <Link href="/admin/series" style={{ fontSize: 13.5, fontWeight: 600, color: '#DC2626', textDecoration: 'none' }}>Cancel</Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/admin/chapters/new?series_id=${id}`}>
              <button type="button"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Add Chapter
              </button>
            </Link>
            <button type="submit" disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}