'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CloudUpload, X, Loader2, ImageIcon, CheckCircle2, Circle } from 'lucide-react'

// ─── Styles ───────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewPostPage() {
  const router = useRouter()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [imageFile,   setImageFile]   = useState<File | null>(null)
  const [preview,     setPreview]     = useState<string | null>(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasImage = imageFile !== null
  const hasTitle = title.trim().length > 0
  const canSave  = hasImage && hasTitle

  // ── File handling ──────────────────────────────────────────────────────────
  function pickFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) pickFile(file)
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true) }
  function handleDragLeave()                    { setDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) pickFile(file)
  }

  function clearImage() {
    setImageFile(null)
    setPreview(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!imageFile) { toast.error('Please upload an image'); return }
    setSubmitting(true)

    try {
      const imageBase64 = await fileToBase64(imageFile)

      const res  = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       title.trim() || null,
          description: description.trim() || null,
          post_type:   'illustration',
          imageBase64,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Failed to create post')
        return
      }

      toast.success('Illustration published!')
      router.push('/admin/posts')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-page-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-8 pt-6 pb-3 text-sm font-mono-ryu"
        style={{ color: 'var(--ryu-text-2)' }}>
        <Link href="/admin/posts" style={{ color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>
          Posts
        </Link>
        <span style={{ color: 'var(--ryu-text-3)' }}>›</span>
        <span style={{ color: 'var(--ryu-text)' }}>New Illustration</span>
      </div>

      {/* Heading */}
      <div className="px-8 pb-6">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
          style={{ color: 'var(--ryu-primary-deep)' }}>
          Illustration
        </div>
        <h1 className="font-heading font-bold"
          style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>
          New Illustration
        </h1>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'flex', flex: 1, gap: 24, padding: '0 32px 112px' }}>

        {/* ── LEFT — Post details ──────────────────────────────────────── */}
        <div style={{ flex: 1, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 01 Details card */}
          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18, paddingBottom: 10, borderBottom: '1px dashed var(--ryu-border)' }}>
              <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>01</span>
              <span className="font-heading" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ryu-text)' }}>Post details</span>
            </div>

            {/* Checklist */}
              <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: '16px 18px' }}>
                <div className="font-mono-ryu text-[10px] tracking-widest uppercase mb-3"
                  style={{ color: 'var(--ryu-text-2)' }}>
                  Checklist
                </div>
                {[
                  { label: 'Title added',       done: hasTitle  },
                  { label: 'Image uploaded',    done: hasImage  },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                    {item.done
                      ? <CheckCircle2 size={13} style={{ color: '#16A34A', flexShrink: 0 }} />
                      : <Circle       size={13} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Title */}
              <div>
                <label style={labelStyle}>
                  Title <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                </label>
                <input
                  style={inputStyle}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Quick warm-up sketch"
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>
                  Description{' '}
                  <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a caption or note…"
                />
              </div>

            </div>
          </div>

        </div>
        {/* ── END LEFT ─────────────────────────────────────────────────── */}

        {/* ── RIGHT — Image upload ─────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4"
          style={{ flex: 1, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ryu-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>02</span>
                <span className="font-heading" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ryu-text)' }}>Image</span>
              </div>
              <span className="font-mono-ryu text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--ryu-accent)', color: '#713F12' }}>
                Required
              </span>
            </div>

            <div style={{ padding: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* No image yet — drop zone */}
              {!preview && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 8, borderRadius: 10, textAlign: 'center',
                    padding: '40px 16px', cursor: 'pointer',
                    border: `1.5px dashed ${dragOver ? 'var(--ryu-primary)' : 'var(--ryu-border)'}`,
                    background: dragOver ? 'var(--ryu-primary-soft)' : 'var(--ryu-surface-2)',
                    transition: 'border-color 150ms ease, background 150ms ease',
                  }}
                >
                  <span style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'var(--ryu-primary-soft)',
                    color: 'var(--ryu-primary-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CloudUpload size={20} />
                  </span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)', margin: 0 }}>
                    Select image
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--ryu-text-3)', margin: 0 }}>
                    Drop here · PNG, JPG, WEBP · any size
                  </p>
                </div>
              )}

              {/* Image selected — preview */}
              {preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ryu-border)' }}>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420, objectFit: 'contain', background: 'var(--ryu-surface-2)' }}
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 28, height: 28, borderRadius: 99,
                        background: 'rgba(28,25,23,0.7)', color: '#fff',
                        border: 'none', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* File info */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ImageIcon size={13} style={{ color: 'var(--ryu-text-3)' }} />
                      <span style={{ fontSize: 11.5, color: 'var(--ryu-text-2)' }}>
                        {imageFile?.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        fontSize: 11.5, fontWeight: 600,
                        color: 'var(--ryu-primary-deep)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      Replace
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* ── END RIGHT ────────────────────────────────────────────────── */}

      </div>

      {/* Fixed bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(to top, var(--background) 60%, transparent)',
        padding: '20px 32px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/admin/posts"
          style={{ fontSize: 13.5, fontWeight: 600, color: '#DC2626', textDecoration: 'none' }}>
          Discard
        </Link>
        <button
          type="button"
          disabled={submitting || !canSave}
          onClick={handleSubmit}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 22px', borderRadius: 8,
            border: '1px solid var(--ryu-primary-deep)',
            background: 'var(--ryu-primary)',
            color: '#fff', fontSize: 13.5, fontWeight: 600,
            cursor: canSave && !submitting ? 'pointer' : 'not-allowed',
            opacity: !canSave || submitting ? 0.5 : 1,
            boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
          }}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Publishing…' : 'Publish Illustration'}
        </button>
      </div>

    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}