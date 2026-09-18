import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PostsClient from '../(components)/PostsClient'

export const metadata: Metadata = {
  title: 'Illustration',
  description: 'Random drawings, WIPs, memes, and everything in between.',
}

export const revalidate = 60

const POST_TYPES = ['sketch', 'drawing', 'meme', 'other']

const TYPE_FILTERS = [
  { value: undefined,  label: 'All' },
  { value: 'sketch',   label: 'Sketch' },
  { value: 'drawing',  label: 'Drawing' },
  { value: 'meme',     label: 'Meme' },
  { value: 'other',    label: 'Other' },
]

async function getPosts(type?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('posts')
    .select('id, title, description, image_url, post_type, created_at')
    .order('created_at', { ascending: false })

  if (type && POST_TYPES.includes(type)) {
    query = query.eq('post_type', type)
  }

  const { data, error } = await query
  console.log('posts data:', data, 'error:', error)
  return data ?? []
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const posts = await getPosts(type)

  return (
    <main className="flex-1">
      {/* Page header */}
      <div
        className="border-b"
        style={{
          background: 'var(--ryu-surface-1)',
          borderColor: 'var(--ryu-border)',
        }}
      >
        <div className="max-w-400 mx-auto px-12 py-6">
          <h1
            className="text-3xl leading-none mb-1"
            style={{
              fontFamily: "var(--font-fredoka), sans-serif",
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--ryu-text)',
            }}
          >
            Illustration
          </h1>
          <p className="text-sm" style={{ color: 'var(--ryu-text-secondary)' }}>
            Random drawings, WIPs, memes, and everything in between.
          </p>
        </div>
      </div>

      {/* Post-type filter — mirrors the genre/status pill pattern on /comics.
          Plain links (not client state) so the active type stays in the URL
          and a filtered view is shareable/bookmarkable. */}
      <div
        className="border-b"
        style={{ background: 'var(--ryu-surface-1)', borderColor: 'var(--ryu-border)' }}
      >
        <div className="max-w-400 mx-auto px-12 py-3 flex items-center gap-2 flex-wrap">
          {TYPE_FILTERS.map(filter => {
            const active = (type ?? undefined) === filter.value
            return (
              <Link
                key={filter.label}
                href={filter.value ? `/posts?type=${filter.value}` : '/posts'}
                className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                style={{
                  fontFamily: "var(--font-fredoka), sans-serif",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: active ? '0.02em' : '0',
                  textTransform: active ? 'uppercase' as const : 'none' as const,
                  fontSize: active ? '12px' : '11px',
                  border: active
                    ? '0.5px solid var(--ryu-primary)'
                    : '0.5px solid var(--ryu-border)',
                  background: active
                    ? 'color-mix(in srgb, var(--ryu-primary) 12%, transparent)'
                    : 'transparent',
                  color: active ? 'var(--ryu-primary)' : 'var(--ryu-text-secondary)',
                }}
              >
                {filter.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Keyed by type: PostsClient seeds its state from initialPosts once, so
          without a key a pill click changes the URL and the highlighted pill
          but leaves the previous type's grid on screen. */}
      <PostsClient key={type ?? 'all'} initialPosts={posts} activeType={type} />
    </main>
  )
}