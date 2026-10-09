import Image from 'next/image'
import Link from 'next/link'

type Post = {
  id: string; title: string | null; image_url: string
  post_type: string | null; created_at: string | null
}

const typeColors: Record<string, { bg: string; color: string }> = {
  sketch:   { bg: '#FFF7ED', color: '#9A3412' },
  wip:      { bg: '#FEF08A', color: '#713F12' },
  meme:     { bg: '#E1F5EE', color: '#085041' },
  fanart:   { bg: '#FBEAF0', color: '#72243E' },
  announce: { bg: '#E6F1FB', color: '#0C447C' },
}

export default function SketchbookPreview({ posts }: { posts: Post[] }) {
  return (
    <section>
      {/* Section head */}
      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
      <div style={{ width: 5, height: 26, background: 'var(--ryu-primary)', borderRadius: 2, flexShrink: 0 }} />
      <span className="font-comic" style={{ fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ryu-text)' }}>
          From the Illustration
        </span>
        <Link
          href="/posts"
          className="font-reader ml-auto flex items-center gap-1"
          style={{ fontSize: 12, color: 'var(--ryu-primary)', fontWeight: 600 }}
        >
          View all →
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="font-reader" style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}>No posts yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {posts.slice(0, 3).map((post) => {
            const typeStyle = typeColors[post.post_type ?? ''] ?? { bg: 'var(--ryu-surface-2)', color: 'var(--ryu-text-2)' }
            const typeLabel = post.post_type
              ? post.post_type.charAt(0).toUpperCase() + post.post_type.slice(1)
              : null

            return (
              <Link
                key={post.id}
                href="/posts"
                className="group"
                style={{
                  background: 'var(--ryu-surface-1)',
                  border: '0.5px solid var(--ryu-border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'block',
                  transition: 'border-color .15s, transform .15s',
                }}
              >
                {/* Image */}
                <div className="relative w-full" style={{ aspectRatio: '4/3', background: '#1a1a2e' }}>
                  <Image
                    src={post.image_url}
                    alt={post.title ?? 'Illustration'}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Body */}
                <div style={{ padding: '12px 14px 14px' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    {typeLabel && (
                      <span
                        className="font-comic"
                        style={{
                          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                          padding: '3px 9px', borderRadius: 99,
                          background: typeStyle.bg, color: typeStyle.color,
                        }}
                      >
                        {typeLabel}
                      </span>
                    )}
                    {post.created_at && (
                      <span className="font-reader" style={{ fontSize: 11, color: 'var(--ryu-text-3)' }}>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {post.title && (
                    <p className="font-reader line-clamp-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)' }}>
                      {post.title}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}