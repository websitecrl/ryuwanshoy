export type Status = 'ongoing' | 'completed' | 'hiatus'

export type LocalPage = {
  id: string
  file: File
  preview: string
  width: number
  height: number
  oversized: boolean
  uploading?: boolean
  uploaded?: boolean
  error?: string | null
  is_spread?: boolean
}

// All Step 1 form data — lifted to WizardShell so it persists across step changes
export type SeriesFormData = {
  title: string
  slug: string
  description: string
  genre: string
  status: Status
  isEA: boolean
  coverFile: File | null
  coverPreview: string | null
  minAge: number
  bannerFile: File | null
  bannerPreview: string | null
}

export const GENRES = [
  'Action', 'Romance', 'Comedy', 'Drama',
  'Fantasy', 'Horror', 'Slice of Life', 'Other',
]

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--ryu-surface-2)',
  border: '1px solid var(--ryu-border)',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--ryu-text)',
  fontFamily: 'inherit',
  outline: 'none',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--ryu-text)',
  marginBottom: 6,
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function generateSlug(title: string): string {
  return title.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}


export const BOTTOM_BAR: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  zIndex: 50,
  background: 'linear-gradient(to top, var(--ryu-bg, var(--background)) 70%, transparent)',
  padding: '20px 32px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
}

export type ChapterFormData = {
  chapterNumber: number
  chapterTitle: string
  isEA: boolean
  pages: LocalPage[]
}

export const DEFAULT_CHAPTER: ChapterFormData = {
  chapterNumber: 1,
  chapterTitle: '',
  isEA: false,
  pages: [],
}