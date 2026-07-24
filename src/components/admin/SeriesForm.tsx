'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import { uploadToR2 } from '@/lib/r2'
import type { Tables } from '@/types/database'
import { fileToBase64 } from '@/app/admin/series/new/types'
import { resolve } from 'path'
import { rejects } from 'assert'


type Series = Tables<'series'>
interface SeriesFormProps {
  // If editing, existing series is passed in. If creating, it's undefined.
  existing?: Series
}

// Converts a title string into a URL-safe slug
// "My Comic Series!" → "my-comic-series"
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
}

const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Thriller',
]

const STATUSES = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'dropped', label: 'Dropped' },
]

export default function SeriesForm({ existing }: SeriesFormProps) {
  const router = useRouter()
  const isEditing = !!existing

  // Form fields
  const [title, setTitle] = useState(existing?.title ?? '')
  const [slug, setSlug] = useState(existing?.slug ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [genre, setGenre] = useState(existing?.genre ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'ongoing')

  // Cover image — Cloudinary URL (saved) and local preview (before upload)
  const [coverUrl, setCoverUrl] = useState(existing?.cover_image ?? '')
  const [coverPreview, setCoverPreview] = useState(existing?.cover_image ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)

  // Track if admin has manually edited the slug
  // If yes, stop auto-generating it from the title
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When title changes, auto-generate slug unless admin has edited it manually
  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  // When admin manually edits slug, lock auto-generation
  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true)
    setSlug(slugify(value))
  }

  // When admin picks a cover image file
  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Show local preview immediately — don't wait for upload
      const localUrl = URL.createObjectURL(file)
      setCoverPreview(localUrl)
      setCoverFile(file)
    },
    []
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let finalCoverUrl = coverUrl

      // If admin picked a new file, upload it to Cloudinary first
      if (coverFile) {
        const base64 = await fileToBase64(coverFile)
        finalCoverUrl = await uploadToR2(base64, 'covers')
        setCoverUrl(finalCoverUrl)
      }

      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        cover_image: finalCoverUrl || null,
        genre: genre || null,
        status,
      }

      const url = isEditing
        ? `/api/series/${existing.id}`
        : '/api/series'

      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong')
      }

      // Success — go back to the series list
      router.push('/admin/series')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    } 
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise(( resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left column — text fields */}
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Tower of Dawn"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug *
              <span className="ml-2 text-xs text-white/40">
                (used in the URL — auto-generated from title)
              </span>
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g. tower-of-dawn"
              required
            />
            <p className="text-xs text-white/40">
              yoursite.com/comics/{slug || '...'}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this series about?"
              rows={4}
            />
          </div>

          {/* Genre + Status side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={genre} onValueChange={(val) => setGenre(val ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right column — cover image */}
        <div className="space-y-3">
          <Label>Cover Image</Label>
          <p className="text-xs text-white/40">460 × 640px recommended</p>

          {/* Preview box */}
          <div className="relative aspect-460/640 w-full overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {coverPreview ? (
              <Image
                src={coverPreview}
                alt="Cover preview"
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/30">
                No image selected
              </div>
            )}
          </div>

          {/* File input */}
          <Input
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="cursor-pointer"
          />
        </div>
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-3 border-t border-white/10 pt-6">
        <Button type="submit" disabled={loading}>
          {loading
            ? isEditing ? 'Saving...' : 'Creating...'
            : isEditing ? 'Save Changes' : 'Create Series'
          }
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/series')}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}