import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileEdit, BookOpen, Plus, AlertTriangle } from 'lucide-react'
import DeleteAllDraftsButton from './DeleteAllDraftsButton'
import DeleteDraftRowButton from './DeleteDraftRowButton'

type ChapterRow = {
  id: string
  title: string | null
  chapter_number: number
  is_published: boolean
  created_at: string | null
}

type ChapterDraft = {
  id: string 
  title: string | null
  chapter_number: number
  is_published: boolean
  created_at: string | null
  series: {
    id: string 
    title: string 
    slug: string
  }
}

type DraftSeries = {
  id: string
  title: string
  slug: string
  created_at: string | null
  chapters: ChapterRow[]
}

async function getDrafts(): Promise<DraftSeries[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select(`
      id,
      title,
      slug,
      created_at,
      chapters (
        id,
        title,
        chapter_number,
        is_published,
        created_at
      )
    `)
    .eq('is_published', false)
    .order('created_at', { ascending: false })

  return (data as DraftSeries[]) ?? []
}

async function getChapterDrafts(): Promise<ChapterDraft[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('chapters')
    .select(`
      id,
      title,
      chapter_number,
      is_published,
      created_at,
      series (
        id,
        title,
        slug
      )
    `)
    .eq('is_published', false)    
    .order('created_at', { ascending: false })
  

  return (data as ChapterDraft[]) ?? []
}

export default async function DraftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin')

  const drafts = await getDrafts()
  const chapterDrafts = await getChapterDrafts()

  return (
    <div className="p-8 space-y-6 animate-page-in" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div>
        <div
          className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
          style={{ color: 'var(--ryu-primary-deep)' }}
        >
          Admin · Drafts
        </div>
       <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1
            className="font-heading font-bold"
            style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)' }}
          >
            Drafts
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>
            {drafts.length + chapterDrafts.length} unpublished item{(drafts.length + chapterDrafts.length) !== 1 ? 's' : ''}
          </p>
        </div>
        <DeleteAllDraftsButton count={drafts.length} />
      </div>
      </div>

      {/* Empty state */}
      {drafts.length === 0 && chapterDrafts.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }}
        >
          <FileEdit size={32} className="mx-auto mb-3" style={{ color: 'var(--ryu-text-3)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ryu-text-2)' }}>
            No drafts yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ryu-text-3)' }}>
            New series start as drafts automatically
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map(draft => (
            <div
              key={draft.id}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
            >
              {/* Series header */}
              <div
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: '1px solid var(--ryu-border-soft)' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}
                >
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-bold truncate"
                      style={{ color: 'var(--ryu-text)' }}
                    >
                      {draft.title}
                    </span>
                    <span
                      className="font-mono-ryu text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
                    >
                      DRAFT
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ryu-text-2)' }}>
                    ryuwanshoy.com/series/{draft.slug} · Created{' '}
                    {new Date(draft.created_at ?? '').toLocaleDateString('en-PH', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/series/${draft.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)', color: 'var(--ryu-text)' }}
                  >
                    <FileEdit size={13} /> Edit series
                  </Link>
                  <Link
                    href={`/admin/chapters/new?series_id=${draft.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--ryu-primary)', border: '1px solid var(--ryu-primary-deep)', color: '#fff' }}
                  >
                    <Plus size={13} /> Add chapter
                  </Link>
                  <DeleteDraftRowButton kind="series" id={draft.id} label={draft.title} />
                </div>
              </div> 
            </div>
          ))}
        </div>
      )}

    {/* Chapter drafts section */}
      {chapterDrafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold font-mono-ryu tracking-widest uppercase" style={{ color: 'var(--ryu-text-3)' }}>
            Unpublished Chapters
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
            <div className="divide-y" style={{ borderColor: 'var(--ryu-border-soft)' }}>
              {chapterDrafts.map(ch => (
                <div key={ch.id} className="flex items-center gap-4 px-5 py-3">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 font-mono-ryu"
                    style={{ background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-2)' }}
                  >
                    {ch.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ryu-text)' }}>
                      Chapter {ch.chapter_number}
                      {ch.title ? ` — ${ch.title}` : ''}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ryu-text-2)' }}>
                      {ch.series.title}
                    </p>
                  </div>
                  {/* A titleless chapter is easy to forget about once buried
                      in a long draft list — call it out so it doesn't get
                      published untitled by accident. */}
                  {!ch.title && (
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                      title="This chapter has no title yet"
                    >
                      <AlertTriangle size={11} /> No title
                    </span>
                  )}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
                  >
                    Draft
                  </span>
                  <Link
                    href={`/admin/chapters/${ch.id}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0"
                    style={{ background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)', color: 'var(--ryu-text-2)' }}
                  >
                    <FileEdit size={11} /> Edit
                  </Link>
                  <DeleteDraftRowButton
                    kind="chapter"
                    id={ch.id}
                    label={`Chapter ${ch.chapter_number}${ch.title ? ` — ${ch.title}` : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}  
    </div>
  )
}