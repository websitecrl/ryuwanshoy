'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Image as ImageIcon, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Card, CardLabel } from './components'
import { BOTTOM_BAR, GENRES, inputStyle, labelStyle, generateSlug, type SeriesFormData } from './types'
import { compressImage } from '@/lib/image-compress'

interface Step1Props {
  data: SeriesFormData
  onChange: (patch: Partial<SeriesFormData>) => void
  onNext: (seriesId: string) => void
  existingSeriesId?: string 
}

export default function Step1({ data, onChange, onNext, existingSeriesId }: Step1Props) {
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver]     = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)

  const hasTitle = data.title.trim().length > 0
  const hasSlug  = data.slug.trim().length > 0

  function handleTitleChange(value: string) {
    const newSlug = data.slug === generateSlug(data.title) || data.slug === ''
      ? generateSlug(value) : data.slug
    onChange({ title: value, slug: newSlug })
  }

  function handleCoverFile(file: File) {
    onChange({ coverFile: file, coverPreview: URL.createObjectURL(file) })
  }
  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) handleCoverFile(f)
  }
  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true) }
  function handleDragLeave()                    { setDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.type.startsWith('image/')) handleCoverFile(f)
  }

  async function saveAndProceed(destination: 'draft' | 'next') {
    if (!data.title.trim()) { toast.error('Title is required'); return }
    if (!data.slug.trim())  { toast.error('Slug is required');  return }
    // if series was already created skip the POST
    if (destination === 'next' && existingSeriesId) {
        toast.success('Continuing with existing series')
        onNext(existingSeriesId)
        return
    }
    setSubmitting(true)

    let coverImageBase64: string | undefined
    try {
      // Cover cards render at 460x640 — 1280px longest side is plenty of
      // headroom for retina without shipping a multi-MB original.
      if (data.coverFile) coverImageBase64 = await compressImage(data.coverFile, { maxDimension: 1280 })
    } catch { toast.error('Failed to process images'); setSubmitting(false); return }

    const res = await fetch('/api/series', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title.trim(), slug: data.slug.trim().toLowerCase(),
        description: data.description || null, genre: data.genre || null,
        status: data.status, is_published: false,
        coverImageBase64,
      }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); setSubmitting(false); return }

    if (destination === 'draft') {
      toast.success('Series saved as draft')
      window.location.href = '/admin/drafts'
      return
    }

    toast.success('Series info saved — add your first chapter')
    onNext(json.data.id)
  }

  const checklist = [
    { label: 'Title set',              done: hasTitle },
    { label: 'Slug valid',             done: hasSlug },
    { label: 'Genre selected',         done: data.genre.length > 0 },
    { label: 'Age rating set',         done: data.minAge !== undefined },
    { label: 'Cover image uploaded',   done: !!data.coverPreview },
    { label: 'Description (optional)', done: data.description.trim().length > 0 },
  ]
  const checklistDone = checklist.filter(c => c.done).length

  return (
    <>
      <div className="flex flex-1 gap-6 px-8 pb-28 max-w-8xl mx-auto w-full">

        {/* LEFT — 01 Title & link, 02 Story, 04 Access */}
        <div className="flex-1 space-y-5">

          {/* 01 Title & link */}
          <Card>
            <CardLabel n="01" title="Title & link" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>
                  Series title <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  <span style={{ float: 'right', fontSize: 11, fontWeight: 400, color: 'var(--ryu-text-3)' }}>Shown on the cover &amp; in the URL</span>
                </label>
                <input style={inputStyle} value={data.title} onChange={e => handleTitleChange(e.target.value)} placeholder="My Awesome Comic" />
              </div>
              <div>
                <label style={labelStyle}>
                  Slug <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  <span style={{ float: 'right', fontSize: 11, fontWeight: 400, color: 'var(--ryu-text-3)' }}>auto-generated · click to override</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--ryu-border)', borderRadius: 6, overflow: 'hidden', background: 'var(--ryu-surface-2)' }}>
                  <span style={{ padding: '10px 12px', fontSize: 13, color: 'var(--ryu-text-3)', borderRight: '1px solid var(--ryu-border)', whiteSpace: 'nowrap', userSelect: 'none' }}>ryuwanshoy.com/</span>
                  <input style={{ ...inputStyle, border: 'none', borderRadius: 0, background: 'transparent' }} value={data.slug} onChange={e => onChange({ slug: e.target.value })} placeholder="my-awesome-comic" />
                </div>
                {data.slug && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--ryu-primary-soft)', border: '1px solid var(--ryu-border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--ryu-text-2)' }}>ryuwanshoy.com/series/<strong style={{ color: 'var(--ryu-primary-deep)' }}>{data.slug}</strong></span>
                    <button onClick={() => { navigator.clipboard.writeText(`ryuwanshoy.com/series/${data.slug}`); toast.success('Copied!') }} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ryu-primary-deep)', background: 'none', border: 'none', cursor: 'pointer' }}>Copy</button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* 02 Story */}
          <Card>
            <CardLabel n="02" title="Story" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Description <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ryu-text-3)' }}>optional · 280 char recommended</span></label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={data.description} onChange={e => onChange({ description: e.target.value })} placeholder="A two-line synopsis that hooks the reader. Avoid spoilers, keep it punchy." />
              </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Genre <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                    <select style={inputStyle} value={data.genre} onChange={e => onChange({ genre: e.target.value })}>
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                    <select style={inputStyle} value={data.status} onChange={e => onChange({ status: e.target.value as SeriesFormData['status'] })}>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="hiatus">Hiatus</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Age rating <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                    <select style={inputStyle} value={String(data.minAge)} onChange={e => onChange({ minAge: Number(e.target.value) })}>
                      <option value="13">13+</option>
                      <option value="16">16+</option>
                      <option value="18">18+</option>
                    </select>
                  </div>
                </div>
            </div>
          </Card>

          {/* 04 Access */}
          {process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true' && (
            <Card>
              <CardLabel n="04" title="Access" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 2 }}>
                    Early access series
                    {data.isEA && <span style={{ marginLeft: 8, fontSize: 10.5, background: 'var(--ryu-accent)', color: '#713F12', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>EA</span>}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--ryu-text-2)' }}>Only early access subscribers can read this</p>
                </div>
                <button type="button" role="switch" aria-checked={data.isEA} onClick={() => onChange({ isEA: !data.isEA })}
                  style={{ width: 40, height: 22, borderRadius: 99, background: data.isEA ? 'var(--ryu-primary)' : 'var(--ryu-border)', border: `1px solid ${data.isEA ? 'var(--ryu-primary-deep)' : 'var(--ryu-border)'}`, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 200ms ease' }}>
                  <span style={{ position: 'absolute', left: data.isEA ? 18 : 2, top: 2, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }} />
                </button>
              </div>
            </Card>
          )}

        </div>

        {/* RIGHT — 03 Artwork (sticky) */}
        <div className="w-80 shrink-0" style={{ alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
          <Card>
            <CardLabel n="03" title="Artwork" />
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

            {/* Cover uploader */}
            <label style={{ ...labelStyle, marginBottom: 8 }}>Cover <span style={{ color: 'var(--ryu-primary)' }}>*</span> <span style={{ float: 'right', fontSize: 10.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>460 × 640 px</span></label>
            {data.coverPreview ? (
              <div style={{ borderRadius: 10, border: '2px solid var(--ryu-primary)', overflow: 'hidden', background: 'var(--ryu-primary-soft)' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '460/640' }}>
                  <Image src={data.coverPreview} alt="Cover" fill className="object-cover" />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '10px 12px' }}>
                  <button onClick={() => coverInputRef.current?.click()} style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', cursor: 'pointer' }}>Replace</button>
                  <button onClick={() => onChange({ coverFile: null, coverPreview: null })} style={{ fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--ryu-text-3)', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            ) : (
              <div onClick={() => coverInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: `1.5px dashed ${dragOver ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`, background: dragOver ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-2)', padding: '48px 12px', cursor: 'pointer', textAlign: 'center', gap: 6 }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={17} /></span>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ryu-text)' }}>Drag &amp; drop, or browse</p>
                <p style={{ fontSize: 11, color: 'var(--ryu-text-3)' }}>460 × 640 px portrait</p>
              </div>
            )}

            {/* URL preview */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--ryu-border)' }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-2" style={{ color: 'var(--ryu-text-2)' }}>URL preview</div>
              <div style={{ background: 'var(--ryu-surface-3)', borderRadius: 8, padding: '9px 12px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: 12, wordBreak: 'break-all', border: '1px solid var(--ryu-border)' }}>
                <span style={{ color: 'var(--ryu-text-3)' }}>ryuwanshoy.com/series/</span>
                <span style={{ color: 'var(--ryu-primary-deep)', fontWeight: 700 }}>{data.slug || '...'}</span>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--ryu-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase" style={{ color: 'var(--ryu-text-2)' }}>Checklist</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)', border: '1px solid var(--ryu-border)' }}>{checklistDone} / {checklist.length}</span>
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
          </Card>
        </div>

      </div>

      <div style={{ ...BOTTOM_BAR, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        {!submitting && (
          <Link href="/admin/series" style={{ fontSize: 13.5, fontWeight: 600, color: '#DC2626', textDecoration: 'none' }}>
            Discard
          </Link>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: submitting ? 'auto' : 0 }}>
          {!submitting && (
            <button
              disabled={!hasTitle || !hasSlug}
              onClick={() => saveAndProceed('draft')}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: !hasTitle || !hasSlug ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !hasTitle || !hasSlug ? 0.5 : 1 }}>
              Save as draft
            </button>
          )}
          <button
            disabled={submitting || !hasTitle || !hasSlug}
            onClick={() => saveAndProceed('next')}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid var(--ryu-primary-deep)', background: 'var(--ryu-primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: !hasTitle || !hasSlug ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 0 rgba(0,0,0,0.06)', opacity: !hasTitle || !hasSlug ? 0.5 : 1 }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {submitting ? 'Saving...' : 'Next — First Chapter →'}
          </button>
        </div>
      </div>
    </>
  )
}