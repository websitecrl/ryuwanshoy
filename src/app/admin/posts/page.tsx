'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

type Post = {
  id: string; title: string | null; description: string | null
  image_url: string; post_type: string; created_at: string
}

export default function AdminPostsPage() {
  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch('/api/posts')
        if (!res.ok) throw new Error('Failed to load posts')
        const json = await res.json()
        setPosts(json.data)
      } catch (err) { console.error(err); setError('Could not load posts. Please refresh.') }
      finally { setLoading(false) }
    }
    fetchPosts()
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Delete failed') }
      setPosts(prev => prev.filter(p => p.id !== id))
      toast.success('Post deleted')
    } catch (err) { console.error(err); toast.error('Failed to delete post. Please try again.') }
    finally { setDeletingId(null) }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(n => (
          <div key={n} className="h-16 rounded-xl animate-pulse"
            style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />
        ))}
      </div>
    )
  }

  if (error) return <div className="p-8 text-sm" style={{ color: '#DC2626' }}>{error}</div>

  return (
    <div className="p-8 animate-page-in">

      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2"
            style={{ color: 'var(--ryu-primary-deep)' }}>
            Illustration · {posts.length} post{posts.length !== 1 ? 's' : ''}
          </div>
          <h1 className="font-heading font-bold leading-tight"
            style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)' }}>
            Posts
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>
            Illustrations and artwork for the gallery
          </p>
        </div>
        <Link href="/admin/posts/new">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0"
            style={{
              background: '#FEF08A', color: '#1E1E1E',
              border: '1px solid #D4B800', cursor: 'pointer',
              boxShadow: '0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}>
            <Plus size={16} strokeWidth={2.5} /> New Illustration
          </button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl p-16 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}>
            <ImageIcon size={26} />
          </span>
          <div className="font-heading font-semibold text-lg mb-1" style={{ color: 'var(--ryu-text)' }}>
            No illustrations yet
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--ryu-text-2)' }}>
            Upload your first illustration or artwork.
          </p>
          <Link href="/admin/posts/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--ryu-primary)', color: '#fff', border: '1px solid var(--ryu-primary-deep)', cursor: 'pointer' }}>
              <Plus size={15} strokeWidth={2.5} /> Create first illustration
            </button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ryu-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ryu-surface-3)', borderBottom: '1px solid var(--ryu-border)' }}>
                {['Image', 'Title', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-semibold font-mono-ryu text-[10.5px] tracking-widest uppercase"
                    style={{ color: 'var(--ryu-text-2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((post, i) => (
                <tr key={post.id} style={{
                  background: 'var(--ryu-surface-1)',
                  borderBottom: i < posts.length - 1 ? '1px solid var(--ryu-border-soft)' : 'none',
                }}>
                  <td className="px-5 py-3">
                    <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: 'var(--ryu-surface-3)' }}>
                      <Image src={post.image_url} alt={post.title ?? 'Illustration'} fill className="object-cover" sizes="48px" />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div style={{ fontWeight: 600, color: 'var(--ryu-text)' }}>
                      {post.title ?? <span style={{ fontStyle: 'italic', color: 'var(--ryu-text-3)' }}>Untitled</span>}
                    </div>
                    {post.description && (
                      <p style={{ fontSize: 11.5, color: 'var(--ryu-text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {post.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono-ryu text-[11px]" style={{ color: 'var(--ryu-text-2)' }}>
                    {formatDate(post.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link href={`/admin/posts/${post.id}`}>
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-2)', cursor: 'pointer' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-primary)'; el.style.color = 'var(--ryu-primary-deep)' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-border)'; el.style.color = 'var(--ryu-text-2)' }}>
                          <Pencil size={14} />
                        </button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--ryu-border-soft)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-3)', cursor: 'pointer' }}
                          disabled={deletingId === post.id}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#FECACA'; el.style.background = '#FEF2F2'; el.style.color = '#DC2626' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-border-soft)'; el.style.background = 'var(--ryu-surface-1)'; el.style.color = 'var(--ryu-text-3)' }}>
                          <Trash2 size={14} />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete illustration?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the illustration and its image. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(post.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {deletingId === post.id ? 'Deleting…' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}