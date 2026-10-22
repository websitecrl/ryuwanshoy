import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'
import { normalizePostType, POST_LIST_FIELDS, POSTS_PAGE_SIZE } from '@/lib/posts'
import PostsClient from '../(components)/PostsClient'

export const metadata: Metadata = {
  title: 'Illustration',
  description: 'Random drawings, WIPs, memes, and everything in between.',
}

// Rendered per request (?type=); only the first page of posts is cached.

const TYPE_FILTERS = [
  { value: undefined,  label: 'All' },
  { value: 'sketch',   label: 'Sketch' },
  { value: 'drawing',  label: 'Drawing' },
  { value: 'meme',     label: 'Meme' },
  { value: 'other',    label: 'Other' },
]

/** Cached first page of posts for one type (normalized first, so ?type= can't create unlimited cache keys). */
const queryFirstPage = cachedPublicQuery('posts:first-page', async (type: string | null) => {
  const supabase = createPublicClient()

  let query = supabase
    .from('posts')
    .select(POST_LIST_FIELDS)
    .order('created_at', { ascending: false })
    .limit(POSTS_PAGE_SIZE + 1)

  if (type) {
    query = query.eq('post_type', type)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > POSTS_PAGE_SIZE
  const posts = hasMore ? rows.slice(0, POSTS_PAGE_SIZE) : rows
  const last = posts[posts.length - 1]
  return { posts, nextCursor: hasMore && last?.created_at ? last.created_at : null }
})

// Empty list on failure so the page still renders; failures are never cached.
async function getFirstPage(type: string | null) {
  try {
    return await queryFirstPage(type)
  } catch (err) {
    console.error('getFirstPage failed:', err)
    return { posts: [], nextCursor: null }
  }
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const { posts, nextCursor } = await getFirstPage(normalizePostType(type))

  return (
    <main className="flex-1">
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

      {/* Plain links, so the filter stays in the URL and can be shared. */}
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

      {/* Keyed by type: PostsClient only seeds its state once. */}
      <PostsClient
        key={type ?? 'all'}
        initialPosts={posts}
        initialCursor={nextCursor}
        activeType={normalizePostType(type) ?? undefined}
      />
    </main>
  )
}