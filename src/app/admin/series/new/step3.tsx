'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { CheckCircle2, Circle, ArrowLeft, Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardLabel } from './components'
import { BOTTOM_BAR, LocalPage, type SeriesFormData } from './types'

interface Step3Props {
  seriesId: string
  seriesData: SeriesFormData
  chapterId: string
  uploadedPages: LocalPage[]
  onBack: () => void
}
 
// ── Scroll viewer — pages stacked vertically ───────────────────────────────
 
function ScrollViewer({ pages }: { pages: LocalPage[] }) {
  if (pages.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--ryu-text-3)', fontSize: 13 }}>
        No pages uploaded
      </div>
    )
  }
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '16px 0', background: '#111', borderRadius: 10, overflowY: 'auto', maxHeight: 700 }}>
      {pages.map((page, idx) => (
        <div key={page.id} style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
          {/* Page number badge */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
            P{String(idx + 1).padStart(2, '0')}
          </div>
          <Image
            src={page.preview}
            alt={`Page ${idx + 1}`}
            width={500}
            height={700}
            className="w-full h-auto block"
            style={{ display: 'block' }}
          />
        </div>
      ))}
    </div>
  )
}
 
// ── Flip viewer — 2 pages side by side, paginated ─────────────────────────
 
// Replace the entire FlipViewer function in Step3.tsx with this

function FlipViewer({ pages }: { pages: LocalPage[] }) {
  const totalSpreads              = Math.ceil(pages.length / 2)
  const [spread, setSpread]       = useState(0)
  const [flipping, setFlipping]   = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [showNext, setShowNext]   = useState(false) // shows next spread's page during animation

  if (pages.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--ryu-text-3)', fontSize: 13 }}>
        No pages uploaded
      </div>
    )
  }

  function go(dir: 'next' | 'prev') {
    if (flipping) return
    if (dir === 'next' && spread >= totalSpreads - 1) return
    if (dir === 'prev' && spread <= 0) return

    setDirection(dir)
    setFlipping(true)
    setShowNext(true)

    // At halfway point (page is edge-on) — swap the spread
    setTimeout(() => {
      setSpread(s => dir === 'next' ? s + 1 : s - 1)
      setShowNext(false)
    }, 320)

    setTimeout(() => setFlipping(false), 640)
  }

  const leftIdx  = spread * 2
  const rightIdx = spread * 2 + 1
  const leftPage  = pages[leftIdx]
  const rightPage = pages[rightIdx]

  // Peek at next/prev spread for the animation ghost page
  const nextLeftIdx  = direction === 'next' ? (spread + 1) * 2     : (spread - 1) * 2
  const nextRightIdx = direction === 'next' ? (spread + 1) * 2 + 1 : (spread - 1) * 2 + 1
  const ghostPage    = direction === 'next' ? pages[nextRightIdx]   : pages[nextLeftIdx]

  const PAGE_W = 420
  const PAGE_H = Math.round(400 * (3300 / 2550 ))

  return (
    <>
      <style>{`
        @keyframes curlForward {
          0%   { transform: perspective(2400px) rotateY(0deg); }
          100% { transform: perspective(2400px) rotateY(-180deg); }
        }
        @keyframes curlBack {
          0%   { transform: perspective(2400px) rotateY(0deg); }
          100% { transform: perspective(2400px) rotateY(180deg); }
        }
        .curl-forward {
          animation: curlForward 640ms cubic-bezier(0.45, 0, 0.55, 1) forwards;
          transform-origin: left center;
          transform-style: preserve-3d;
        }
        .curl-back {
          animation: curlBack 640ms cubic-bezier(0.45, 0, 0.55, 1) forwards;
          transform-origin: right center;
          transform-style: preserve-3d;
        }
      `}</style>

      <div style={{ background: '#111', borderRadius: 10, padding: '20px 16px 20px' }}>

        {/* Spread label */}
        <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 11, color: '#555', fontFamily: 'monospace', letterSpacing: 1 }}>
          P{String(leftIdx + 1).padStart(2, '0')}
          {rightPage ? ` — P${String(rightIdx + 1).padStart(2, '0')}` : ''}
          {' · '}Spread {spread + 1} / {totalSpreads}
        </div>

        {/* Book spread */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>

          {/* ── LEFT PAGE ── */}
          <div style={{ position: 'relative', width: PAGE_W, height: PAGE_H, background: '#1a1a1a', borderRadius: '6px 0 0 6px', overflow: 'hidden', flexShrink: 0 }}>
            {leftPage ? (
              <Image
                src={leftPage.preview}
                alt={`Page ${leftIdx + 1}`}
                fill
                className="object-cover"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 }}>
                —
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 8, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
              P{String(leftIdx + 1).padStart(2, '0')}
            </div>

            {/* Ghost page slides in from left when going Prev */}
            {flipping && direction === 'prev' && showNext && ghostPage && (
              <div
                className="curl-back"
                style={{ position: 'absolute', inset: 0, zIndex: 2, transformOrigin: 'right center' }}
              >
                <Image
                  src={ghostPage.preview}
                  alt="turning"
                  fill
                  className="object-cover"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                />
              </div>
            )}
          </div>

          {/* ── SPINE ── */}
          <div style={{
            width: 8, flexShrink: 0,
            background: 'linear-gradient(to right, #0a0a0a 0%, #3a3a3a 30%, #2a2a2a 70%, #0a0a0a 100%)',
            boxShadow: '-3px 0 10px rgba(0,0,0,0.6), 3px 0 10px rgba(0,0,0,0.6)',
            zIndex: 3,
          }} />

          {/* ── RIGHT PAGE ── */}
          <div style={{ position: 'relative', width: PAGE_W, height: PAGE_H, background: '#1a1a1a', borderRadius: '0 6px 6px 0', overflow: 'hidden', flexShrink: 0 }}>
            {rightPage ? (
              <Image
                src={rightPage.preview}
                alt={`Page ${rightIdx + 1}`}
                fill
                className="object-cover"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 }}>
                End of chapter
              </div>
            )}
            {rightPage && (
              <div style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                P{String(rightIdx + 1).padStart(2, '0')}
              </div>
            )}

            {/* Flipping page — curls forward over the right side when going Next */}
            {flipping && direction === 'next' && showNext && ghostPage && (
              <div
                className="curl-forward"
                style={{ position: 'absolute', inset: 0, zIndex: 2, transformOrigin: 'left center' }}
              >
                <Image
                  src={ghostPage.preview}
                  alt="turning"
                  fill
                  className="object-cover"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                />
              </div>
            )}
          </div>

        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button
            onClick={() => go('prev')}
            disabled={spread === 0 || flipping}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: spread === 0 ? '#1a1a1a' : '#2a2a2a', color: spread === 0 ? '#444' : '#ccc', border: '1px solid #333', fontSize: 13, fontWeight: 600, cursor: spread === 0 || flipping ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}
          >
            <ChevronLeft size={15} /> Prev
          </button>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: totalSpreads }).map((_, i) => (
              <button
                key={i}
                onClick={() => { if (!flipping && i !== spread) { setDirection(i > spread ? 'next' : 'prev'); setSpread(i) } }}
                style={{ width: i === spread ? 20 : 6, height: 6, borderRadius: 99, background: i === spread ? 'var(--ryu-primary)' : '#444', border: 'none', cursor: 'pointer', transition: 'all 200ms ease', padding: 0 }}
              />
            ))}
          </div>

          <button
            onClick={() => go('next')}
            disabled={spread === totalSpreads - 1 || flipping}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: spread === totalSpreads - 1 ? '#1a1a1a' : 'var(--ryu-primary)', color: spread === totalSpreads - 1 ? '#444' : '#fff', border: `1px solid ${spread === totalSpreads - 1 ? '#333' : 'var(--ryu-primary-deep)'}`, fontSize: 13, fontWeight: 600, cursor: spread === totalSpreads - 1 || flipping ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>

      </div>
    </>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────
 
export default function Step3({ seriesId, seriesData, chapterId, uploadedPages, onBack }: Step3Props) {
  const router      = useRouter()
  const [mode, setMode]         = useState<'scroll' | 'flip'>('scroll')
  const [publishing, setPublishing] = useState(false)
 
  async function handlePublish() {
    setPublishing(true)
 
    const sRes  = await fetch(`/api/series/${seriesId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: true }),
    })
    const sJson = await sRes.json()
    if (sJson.error) { toast.error(sJson.error); setPublishing(false); return }
 
    await fetch(`/api/chapters/${chapterId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: true }),
    })
 
    toast.success(`"${seriesData.title}" is now live!`)
    router.replace('/admin/series')
  }
 
  const preflight = [
    { label: 'Series title & slug',                           done: seriesData.title.trim().length > 0 && seriesData.slug.trim().length > 0 },
    { label: 'Genre + status',                                done: seriesData.genre.length > 0 },
    { label: 'Cover image',                                   done: !!seriesData.coverPreview },
    { label: `Chapter 1 uploaded · ${uploadedPages.length} pages`, done: uploadedPages.length > 0 },
    { label: 'Pages in reading order',                        done: uploadedPages.length > 0 },
    { label: 'Reader preview tested',                         done: true },
  ]
  const preflightDone = preflight.filter(p => p.done).length
 
  const whenYouPublish = [
    { text: `Series appears on ryuwanshoy.com/series/${seriesData.slug} immediately.`, icon: '✓', green: true },
    { text: `Chapter 1 (${uploadedPages.length} pages) goes live; readers can read it.`, icon: '✓', green: true },
    { text: 'Pages uploaded to Cloudflare R2 & cached on CDN (≈ 2 min).', icon: '✓', green: true },
  //   { text: 'Early-access subscribers get a push notification.', icon: '○', green: false },
  ]
 
  return (
    <>
      <div className="flex flex-1 gap-6 px-8 pb-28 max-w-8xl mx-auto w-full" style={{ alignItems: 'flex-start' }}>
 
        {/* LEFT — reader preview + series summary */}
        <div className="flex-1 space-y-5">
 
          {/* Reader preview */}
          <Card>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--ryu-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>👁</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ryu-text)', margin: 0 }}>Reader preview</p>
                  <p style={{ fontSize: 11, color: 'var(--ryu-text-3)', margin: 0 }}>What your audience sees · {uploadedPages.length} pages</p>
                </div>
              </div>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)' }}>
                <button onClick={() => setMode('scroll')}
                  style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms ease', background: mode === 'scroll' ? 'var(--ryu-primary)' : 'transparent', color: mode === 'scroll' ? '#fff' : 'var(--ryu-text-2)' }}>
                  ⊞ Scroll mode
                </button>
                <button onClick={() => setMode('flip')}
                  style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms ease', background: mode === 'flip' ? 'var(--ryu-primary)' : 'transparent', color: mode === 'flip' ? '#fff' : 'var(--ryu-text-2)' }}>
                  ⊡ Flip 
                </button>
              </div>
            </div>
 
            {/* Mode label */}
            <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--ryu-text-3)', fontFamily: 'monospace' }}>
              {mode === 'scroll'
                ? '↕ Scroll mode — pages stacked vertically, like Webtoon'
                : '⇆ Flip mode — 2 pages side by side, like an open book'}
            </div>
 
            {/* Viewer */}
            {mode === 'scroll'
              ? <ScrollViewer pages={uploadedPages} />
              : <FlipViewer   pages={uploadedPages} />
            }
          </Card>
 
          {/* Series summary */}
          <Card>
            <CardLabel n="01" title="Series summary" />
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Cover */}
              <div style={{ width: 90, height: 126, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--ryu-surface-3)', border: '1px solid var(--ryu-border)' }}>
                {seriesData.coverPreview
                  ? <Image src={seriesData.coverPreview} alt="Cover" fill className="object-cover" />
                  : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 8, background: 'linear-gradient(to bottom, #3D1A0E, #7C2D12)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{seriesData.title || 'Untitled'}</p>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{seriesData.genre}</p>
                    </div>
                  )
                }
              </div>
              {/* Meta */}
              <div style={{ flex: 1 }}>
                <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ryu-text)', marginBottom: 2 }}>{seriesData.title || 'Untitled'}</h2>
                <p style={{ fontSize: 12, color: 'var(--ryu-text-2)', marginBottom: 12 }}>
                  {seriesData.genre} · {seriesData.status.charAt(0).toUpperCase() + seriesData.status.slice(1)}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'CHAPTERS', value: '1' },
                    { label: 'PAGES',    value: String(uploadedPages.length) },
                    { label: 'URL',      value: `/${seriesData.slug.slice(0, 8)}${seriesData.slug.length > 8 ? '…' : ''}` },
                    { label: 'STATUS',   value: 'Draft', highlight: true },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-2)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ryu-text-3)', letterSpacing: 0.8, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: item.highlight ? 'var(--ryu-primary)' : 'var(--ryu-text)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {seriesData.description && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-2)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ryu-text-3)', letterSpacing: 0.8, marginBottom: 6 }}>SYNOPSIS</div>
                    <p style={{ fontSize: 12, color: 'var(--ryu-text-2)', lineHeight: 1.5, margin: 0 }}>{seriesData.description}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
 
        </div>
 
        {/* RIGHT — sticky panel */}
        <div className="w-64 shrink-0 hidden lg:block" style={{ alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
          <div className="space-y-4">
 
            {/* Pre-flight checklist */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase" style={{ color: 'var(--ryu-text-2)' }}>Pre-flight</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: preflightDone === preflight.length ? '#DCFCE7' : 'var(--ryu-primary-soft)', color: preflightDone === preflight.length ? '#15803D' : 'var(--ryu-primary-deep)', border: '1px solid var(--ryu-border)' }}>
                  {preflightDone} / {preflight.length} ready
                </span>
              </div>
              {preflight.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  {item.done
                    ? <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                    : <Circle      size={14} style={{ color: 'var(--ryu-text-3)', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 12, color: item.done ? 'var(--ryu-text)' : 'var(--ryu-text-3)' }}>{item.label}</span>
                </div>
              ))}
            </Card>
 
            {/* When you publish */}
            <Card>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-3" style={{ color: 'var(--ryu-text-2)' }}>When you publish</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {whenYouPublish.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: item.green ? '#16A34A' : 'var(--ryu-text-3)', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                    <p style={{ fontSize: 12, color: 'var(--ryu-text-2)', lineHeight: 1.4, margin: 0 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </Card>
 
          </div>
        </div>
      </div>
 
      <div style={BOTTOM_BAR}>
        {/* Hide back + draft buttons while publishing */}
        {!publishing && (
          <button onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text-2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={15} /> Back to chapter
          </button>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: publishing ? 'auto' : 0 }}>
          {!publishing && (
            <button onClick={() => { window.location.href = '/admin/drafts' }}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              Save as draft
            </button>
          )}
          <button disabled={publishing} onClick={handlePublish}
            style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid #15803D', background: '#16A34A', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: publishing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}>
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {publishing ? 'Publishing...' : 'Publish series now'}
          </button>
        </div>
      </div>
    </>
  )
}