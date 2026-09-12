'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { CloudUpload, X, Loader2, ImageIcon, AlertCircle } from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Tables } from '@/types/database'
import { compressImage } from '@/lib/image-compress'

// ─── Types ────────────────────────────────────────────────────────────────────

type Post     = Tables<'posts'>
type PostType = 'sketch' | 'drawing' | 'meme' | 'other'

const POST_TYPES: { value: PostType; label: string; }[] = [
  { value: 'sketch',  label: 'Sketch' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'meme',    label: 'Meme' },
  { value: 'other',   label: 'Other' }
]

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

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()

  const [post,        setPost]        = useState<Post | null>(null)
  const [fetching,    setFetching]    = useState(true)
  const [postId,      setPostId]      = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  // Form fields
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [postType,    setPostType]    = useState<PostType>('sketch')

  // Image replacement
  const [newImageFile,   setNewImageFile]   = useState<File | null>(null)
  const [newPreview,     setNewPreview]     = useState<string | null>(null)
  const [dragOver,       setDragOver]       = useState(false)

  const [submitting,  setSubmitting]  = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch post on mount ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { id } = await params
      setPostId(id)
      try {
        const res  = await fetch(`/api/posts/${id}`)
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to load post')
        const p: Post = json.data
        setPost(p)
        setTitle(p.title ?? '')
        setDescription(p.description ?? '')
        setPostType((p.post_type ?? 'sketch') as PostType)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally { setFetching(false) }
    }
    init()
  }, [params])

  // ── Image replacement ──────────────────────────────────────────────────────
  function pickFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    setNewImageFile(file)
    setNewPreview(URL.createObjectURL(file))
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

  function clearNewImage() { setNewImageFile(null); setNewPreview(null) }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!postId) return
    setError(null)
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        title:       title.trim() || null,
        description: description.trim() || null,
        post_type:   postType,
      }

      // If a new image was selected, convert and send it
      if (newImageFile) {
        body.imageBase64 = await compressImage(newImageFile, { maxDimension: 1600 })
      }

      const res  = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to save post')

      toast.success('Post updated!')
      router.push('/admin/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      toast.error('Failed to save post')
    } finally { setSubmitting(false) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!postId) return
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete post')
      toast.success('Post deleted')
      router.push('/admin/posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Loading / error guards ─────────────────────────────────────────────────
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

  if (!post) {
    return (
      <div className="p-8 text-sm" style={{ color: '#DC2626' }}>
        {error ?? 'Post not found.'}
      </div>
    )
  }

  // The image shown in the right panel — new preview takes priority over saved URL
  const displayImage = newPreview ?? post.image_url

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
        <span style={{ color: 'var(--ryu-text)' }}>Edit</span>
      </div>

      {/* Heading */}
      <div className="px-8 pb-6">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
          style={{ color: 'var(--ryu-primary-deep)' }}>
          Edit post
        </div>
        <h1 className="font-heading font-bold"
          style={{ fontSize: 36, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>
          {post.title ?? 'Untitled Post'}
        </h1>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-8 mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Type */}
              <div>
                <label style={labelStyle}>Type <span style={{ color: 'var(--ryu-primary)' }}>*</span></label>
                <Select value={postType} onValueChange={v => setPostType(v as PostType)}>
                  <SelectTrigger>
                    <span style={{ fontWeight: 600, color: 'var(--ryu-text)' }}>
                      {POST_TYPES.find(t => t.value === postType)?.label}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div>
                <label style={labelStyle}>
                  Title{' '}
                  <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>(optional)</span>
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
                  <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ryu-text-3)' }}>(optional)</span>
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

        {/* ── RIGHT — Image ────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4"
          style={{ flex: 1, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ryu-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', fontWeight: 600 }}>02</span>
                <span className="font-heading" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ryu-text)' }}>Image</span>
              </div>
              {newPreview && (
                <span className="font-mono-ryu text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--ryu-accent)', color: '#713F12' }}>
                  New image selected
                </span>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Current / new image preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${newPreview ? 'var(--ryu-primary)' : 'var(--ryu-border)'}` }}>
                  <Image
                    src={displayImage}
                    alt={post.title ?? 'Post image'}
                    width={600}
                    height={400}
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 380, objectFit: 'contain', background: 'var(--ryu-surface-2)' }}
                  />
                  {/* Clear new image if one is selected */}
                  {newPreview && (
                    <button
                      type="button"
                      onClick={clearNewImage}
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
                  )}
                </div>

                {/* File info row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={12} style={{ color: 'var(--ryu-text-3)' }} />
                    <span style={{ fontSize: 11, color: 'var(--ryu-text-2)' }}>
                      {newImageFile ? newImageFile.name : 'Current image'}
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
        {/* Left — delete */}
        <AlertDialog>
          <AlertDialogTrigger
            style={{
              fontSize: 13.5, fontWeight: 600, color: '#DC2626',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Delete post
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the post and its image from R2. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Right — cancel + save */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/posts">
            <button style={{
              padding: '10px 18px', borderRadius: 8,
              border: '1px solid var(--ryu-border)',
              background: 'var(--ryu-surface-1)',
              color: 'var(--ryu-text)',
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </Link>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 22px', borderRadius: 8,
              border: '1px solid var(--ryu-primary-deep)',
              background: 'var(--ryu-primary)',
              color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
            }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

    </div>
  )
}
