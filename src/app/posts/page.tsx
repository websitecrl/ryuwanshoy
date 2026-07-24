import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PostsClient from '../(components)/PostsClient'

export const metadata: Metadata = {
  title: 'Illustration',
  description: 'Random drawings, WIPs, memes, and everything in between.',
}

export const revalidate = 60

const POST_TYPES = ['sketch', 'drawing', 'meme', 'other']

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

      <PostsClient initialPosts={posts} activeType={type} />
    </main>
  )
}