import Image from 'next/image'
import Link from 'next/link'

type Series = { title: string; slug: string; cover_image: string | null }
type Chapter = {
  id: string; title: string | null; chapter_number: number
  is_early_access: boolean | null; published_at: string | null; series: Series | null
}

export default function LatestReleases({ chapters }: { chapters: Chapter[] }) {
  return (
    <section>
      {/* Section head */}
      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
     <div style={{ width: 5, height: 26, background: 'var(--ryu-primary)', borderRadius: 2, flexShrink: 0 }} />
     <span className="font-comic" style={{ fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ryu-text)' }}>
          Latest Releases
        </span>
        <Link
          href="/comics"
          className="font-reader ml-auto flex items-center gap-1"
          style={{ fontSize: 12, color: 'var(--ryu-primary)', fontWeight: 600 }}
        >
          View all →
        </Link>
      </div>

      {chapters.length === 0 ? (
        <p className="font-reader" style={{ fontSize: 13, color: 'var(--ryu-text-3)' }}>
          No chapters published yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {chapters.map((chapter) => {
            if (!chapter.series) return null
            const href = `/comics/${chapter.series.slug}/${chapter.chapter_number}`
            return (
              <Link key={chapter.id} href={href} className="group flex flex-col gap-2">
                <div
                  className="relative w-full overflow-hidden"
                  style={{ aspectRatio: '3/4', borderRadius: 8, background: '#1a1a2e',
                    border: '0.5px solid var(--ryu-border)', transition: 'border-color .15s, transform .15s' }}
                >
                  {chapter.series.cover_image ? (
                    <Image
                      src={chapter.series.cover_image}
                      alt={chapter.series.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-reader" style={{ fontSize: 11, color: 'var(--ryu-text-3)' }}>No cover</span>
                    </div>
                  )}
                </div>

                <div>
                  <p className="font-reader line-clamp-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)', lineHeight: 1.3 }}>
                    {chapter.series.title}
                  </p>
                  <p className="font-reader" style={{ fontSize: 11, color: 'var(--ryu-text-3)', marginTop: 2 }}>
                    Ch. {chapter.chapter_number}{chapter.title ? ` — ${chapter.title}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}