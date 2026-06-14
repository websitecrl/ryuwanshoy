'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Series = { title: string; slug: string; min_age: number | null }
type Chapter = { id: string; chapter_number: number }
type HeroSlide = {
  id: string
  headline: string | null
  banner_image: string | null
  is_visible: boolean | null
  order_index: number
  series: Series | null
  chapter: Chapter | null
}

export default function HeroBanner({ slides, siteName }: { slides: HeroSlide[]; siteName: string }) {
  const [idx, setIdx] = useState(0)
  const [maxAge, setMaxAge] = useState<number | null>(null)

  // Read confirmed age from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ryu-age')
    if (stored !== null) setMaxAge(Number(stored))
  }, [])

  // Filter slides by reader's confirmed age
  const visibleSlides = maxAge === null ? [] : slides.filter(s => {
    const age = s.series?.min_age ?? 13
    return age <= maxAge
  })

  // Auto-advance carousel
  useEffect(() => {
    if (visibleSlides.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % visibleSlides.length), 6500)
    return () => clearInterval(t)
  }, [visibleSlides.length])  

  // Fallback — no visible slides
  if (visibleSlides.length === 0) {
    return (
      <div style={{
        height: 470, background: '#0d0d18', borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="text-center" style={{ color: '#fff' }}>
          <h1
            className="font-comic"
            style={{ fontFamily: 'var(--font-bangers), cursive', fontSize: 42, letterSpacing: '0.04em' }}
          >
            {siteName}
          </h1>
          <p className="font-reader" style={{ marginTop: 8, opacity: 0.6, fontSize: 13 }}>
            Original comics and art.
          </p>
          <Link
            href="/comics"
            className="font-comic inline-flex items-center gap-2"
            style={{
              marginTop: 20, height: 36, padding: '0 20px',
              background: '#4D2C7B', color: '#fff',
              border: '2.5px solid #1E1E1E', borderRadius: 8,
              fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
              boxShadow: '4px 4px 0 #1E1E1E',
            }}
          >
            Browse Comics
          </Link>
        </div>
      </div>
    )
  }

  const slide = visibleSlides[idx]
  if (!slide) return null

  return (
    <div style={{
      position: 'relative', height: 470, overflow: 'hidden',
      background: '#0d0d18', borderRadius: 12,
    }}>
      {/* Slides */}
      {visibleSlides.map((s, i) => {
        const slideHref =
          s.series && s.chapter
            ? `/comics/${s.series.slug}/${s.chapter.chapter_number}`
            : s.series ? `/comics/${s.series.slug}` : '/comics'

        return (
          <div
            key={s.id}
            style={{
              position: 'absolute', inset: 0,
              opacity: i === idx ? 1 : 0,
              transition: 'opacity 0.5s ease',
              display: 'flex', alignItems: 'flex-end',
              padding: '32px 36px', color: '#fff',
            }}
          >
            {/* Background image */}
            {s.banner_image && (
              <Image
                src={s.banner_image}
                alt={s.headline ?? 'Hero banner'}
                fill
                className="object-contain"
                priority={i === 0}
              />
            )}

            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 100%)',
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, maxWidth: 620 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <span
                  className="font-comic"
                  style={{
                    background: 'var(--ryu-primary)', color: '#fff',
                    fontSize: 11, padding: '3px 10px', borderRadius: 99,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  {s.series ? 'NEW' : 'FEATURED'}
                </span>
              </div>

              {s.headline && (
                <h2
                  className="font-comic"
                  style={{
                    fontFamily: 'var(--font-bangers), cursive',
                    fontSize: 30, letterSpacing: '0.04em',
                    color: '#fff', lineHeight: 1.15, marginBottom: 10,
                  }}
                >
                  {s.series?.title && (
                    <>{s.series.title} <span style={{ color: 'var(--ryu-primary)' }}>·</span>{' '}</>
                  )}
                  <span style={{ color: 'var(--ryu-primary)' }}>
                    {s.headline.includes('—') ? (s.headline.split('—')[1] ?? s.headline).trim() : s.headline}
                  </span>
                </h2>
              )}

              {s.series && (
                <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
                  <Link
                    href={slideHref}
                    className="font-comic inline-flex items-center gap-2"
                    style={{
                      height: 36, padding: '0 18px',
                      background: '#4D2C7B', color: '#fff',
                      border: '2.5px solid #1E1E1E', borderRadius: 8,
                      fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
                      boxShadow: '4px 4px 0 #1E1E1E',
                    }}
                  >
                    {s.chapter ? 'Read Now' : 'View Series'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Dot indicators */}
      {visibleSlides.length > 1 && (
        <div className="absolute flex gap-2" style={{ bottom: 16, right: 24, zIndex: 3 }}>
          {visibleSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: 24, height: 3, borderRadius: 2,
                border: 'none', padding: 0, cursor: 'pointer',
                background: i === idx ? 'var(--ryu-primary)' : 'rgba(255,255,255,0.25)',
                transition: 'background .2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}