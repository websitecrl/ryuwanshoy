'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, Circle, ArrowLeft, Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardLabel } from './components'
import { BOTTOM_BAR, LocalPage, type SeriesFormData, type SaveState } from './types'

interface Step3Props {
  seriesData: SeriesFormData
  uploadedPages: LocalPage[]
  saving: SaveState
  /** A save already created rows — going back is locked so edits can't drift from them. */
  hasSavedRows: boolean
  onBack: () => void
  onSaveDraft: () => void
  onPublish: () => void
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '16px 0', background: '#111', borderRadius: 10, overflowY: 'auto', maxHeight: 'max(260px, calc(100dvh - 400px))' }}>
      {pages.map((page, idx) => (
        <div key={page.id} style={{ position: 'relative', width: '100%', maxWidth: page.is_spread ? 700 : 500 }}>
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
            P{String(idx + 1).padStart(2, '0')}{page.is_spread ? ' SPREAD' : ''}
          </div>
          <Image
            src={page.preview}
            alt={`Page ${idx + 1}`}
            width={page.is_spread ? 700 : 500}
            height={page.is_spread ? 453 : 700}
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
  const [spread, setSpread]       = useState(0)
  const [flipping, setFlipping]   = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [showNext, setShowNext]   = useState(false)

  // Spread pages expand into two leaves — left half + right half
  type Leaf = LocalPage & { spreadSide: 'left' | 'right' | null }
  const leaves: Leaf[] = pages.flatMap((page): Leaf[] =>
    page.is_spread
      ? [{ ...page, spreadSide: 'left' }, { ...page, spreadSide: 'right' }]
      : [{ ...page, spreadSide: null }]
  )
  const totalSpreads = Math.ceil(leaves.length / 2)

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
    setTimeout(() => { setSpread(s => dir === 'next' ? s + 1 : s - 1); setShowNext(false) }, 320)
    setTimeout(() => setFlipping(false), 640)
  }

  const leftLeaf  = leaves[spread * 2]
  const rightLeaf = leaves[spread * 2 + 1]
  const ghostLeaf = direction === 'next'
    ? leaves[(spread + 1) * 2 + 1]
    : leaves[(spread - 1) * 2]

  // CSS sizes so the open book fits the viewport (0.8108 ≈ the old 420 / 518)
  const PAGE_H = 'clamp(260px, calc(100dvh - 440px), 518px)'
  const PAGE_W = `calc(${PAGE_H} * 0.8108)`

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
          P{String(spread * 2 + 1).padStart(2, '0')}
          {rightLeaf ? ` — P${String(spread * 2 + 2).padStart(2, '0')}` : ''}
          {leftLeaf?.is_spread ? ' · SPREAD' : ''}
          {' · '}Spread {spread + 1} / {totalSpreads}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>

        {/* ── LEFT PAGE ── */}
        <div style={{ position: 'relative', width: PAGE_W, height: PAGE_H, background: '#1a1a1a', borderRadius: '6px 0 0 6px', overflow: 'hidden', flexShrink: 0 }}>
          {leftLeaf ? (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${leftLeaf.preview})`,
              backgroundSize: leftLeaf.spreadSide ? '200% 100%' : 'contain',
              backgroundPosition: leftLeaf.spreadSide === 'left' ? 'left center' : leftLeaf.spreadSide === 'right' ? 'right center' : 'center center',
              backgroundRepeat: 'no-repeat',
            }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 }}>—</div>
          )}
          <div style={{ position: 'absolute', bottom: 8, left: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
            P{String(spread * 2 + 1).padStart(2, '0')}{leftLeaf?.spreadSide ? ' L' : ''}
          </div>
          {flipping && direction === 'prev' && showNext && ghostLeaf && (
            <div className="curl-back" style={{ position: 'absolute', inset: 0, zIndex: 2, transformOrigin: 'right center' }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${ghostLeaf.preview})`,
                backgroundSize: ghostLeaf.spreadSide ? '200% 100%' : 'contain',
                backgroundPosition: ghostLeaf.spreadSide === 'left' ? 'left center' : ghostLeaf.spreadSide === 'right' ? 'right center' : 'center center',
                backgroundRepeat: 'no-repeat',
              }} />
            </div>
          )}
        </div>

          {/* ── SPINE ── */}
          <div style={{ width: 8, flexShrink: 0, background: 'linear-gradient(to right, #0a0a0a 0%, #3a3a3a 30%, #2a2a2a 70%, #0a0a0a 100%)', boxShadow: '-3px 0 10px rgba(0,0,0,0.6), 3px 0 10px rgba(0,0,0,0.6)', zIndex: 3 }} />

          {/* ── RIGHT PAGE ── */}
          <div style={{ position: 'relative', width: PAGE_W, height: PAGE_H, background: '#1a1a1a', borderRadius: '0 6px 6px 0', overflow: 'hidden', flexShrink: 0 }}>
            {rightLeaf ? (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${rightLeaf.preview})`,
                backgroundSize: rightLeaf.spreadSide ? '200% 100%' : 'contain',
                backgroundPosition: rightLeaf.spreadSide === 'left' ? 'left center' : rightLeaf.spreadSide === 'right' ? 'right center' : 'center center',
                backgroundRepeat: 'no-repeat',
              }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 }}>End of chapter</div>
            )}
            {rightLeaf && (
              <div style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                P{String(spread * 2 + 2).padStart(2, '0')}{rightLeaf.spreadSide ? ' R' : ''}
              </div>
            )}
            {flipping && direction === 'next' && showNext && ghostLeaf && (
              <div className="curl-forward" style={{ position: 'absolute', inset: 0, zIndex: 2, transformOrigin: 'left center' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${ghostLeaf.preview})`,
                  backgroundSize: ghostLeaf.spreadSide ? '200% 100%' : 'contain',
                  backgroundPosition: ghostLeaf.spreadSide === 'left' ? 'left center' : ghostLeaf.spreadSide === 'right' ? 'right center' : 'center center',
                  backgroundRepeat: 'no-repeat',
                }} />
              </div>
            )}
          </div>

        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button onClick={() => go('prev')} disabled={spread === 0 || flipping}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: spread === 0 ? '#1a1a1a' : '#2a2a2a', color: spread === 0 ? '#444' : '#ccc', border: '1px solid #333', fontSize: 13, fontWeight: 600, cursor: spread === 0 || flipping ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}>
            <ChevronLeft size={15} /> Prev
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: totalSpreads }).map((_, i) => (
              <button key={i}
                onClick={() => { if (!flipping && i !== spread) { setDirection(i > spread ? 'next' : 'prev'); setSpread(i) } }}
                style={{ width: i === spread ? 20 : 6, height: 6, borderRadius: 99, background: i === spread ? 'var(--ryu-primary)' : '#444', border: 'none', cursor: 'pointer', transition: 'all 200ms ease', padding: 0 }} />
            ))}
          </div>
          <button onClick={() => go('next')} disabled={spread === totalSpreads - 1 || flipping}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: spread === totalSpreads - 1 ? '#1a1a1a' : 'var(--ryu-primary)', color: spread === totalSpreads - 1 ? '#444' : '#fff', border: `1px solid ${spread === totalSpreads - 1 ? '#333' : 'var(--ryu-primary-deep)'}`, fontSize: 13, fontWeight: 600, cursor: spread === totalSpreads - 1 || flipping ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}>
            Next <ChevronRight size={15} />
          </button>
        </div>

      </div>
    </>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────
 
export default function Step3({ seriesData, uploadedPages, saving, hasSavedRows, onBack, onSaveDraft, onPublish }: Step3Props) {
  const [mode, setMode] = useState<'scroll' | 'flip'>('scroll')
  const publishing = saving !== null

  // Pages a previous save attempt didn't finish — Publish / Save as draft retry these only
  const failedPages  = uploadedPages.flatMap((p, i) => p.error ? [i + 1] : [])
  const pendingCount = uploadedPages.filter(p => !p.uploaded).length

  const preflight = [
    { label: 'Series title & slug',                           done: seriesData.title.trim().length > 0 && seriesData.slug.trim().length > 0 },
    { label: 'Genre + status',                                done: seriesData.genre.length > 0 },
    { label: 'Cover image',                                   done: !!seriesData.coverPreview },
    { label: `Chapter 1 uploaded · ${uploadedPages.length} pages`, done: uploadedPages.length > 0 },
    { label: 'Pages in reading order',                        done: uploadedPages.length > 0 },
    { label: 'Reader preview tested',                         done: true },
  ]
  const preflightDone = preflight.filter(p => p.done).length
 
  return (
    <>
      <div className="flex flex-1 min-h-0 overflow-y-auto gap-6 px-8 pb-4 max-w-8xl mx-auto w-full" style={{ alignItems: 'flex-start' }}>
 
        {/* LEFT — reader preview */}
        <div className="flex-1 space-y-5">

          {/* Partial save — rows exist unpublished, some pages still need uploading */}
          {hasSavedRows && !publishing && pendingCount > 0 && (
            <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #FCA5A5', background: 'var(--ryu-surface-1)', fontSize: 12.5, color: 'var(--ryu-text)', lineHeight: 1.5 }}>
              <strong>Nothing is published yet.</strong>{' '}
              {failedPages.length > 0 && <>Page {failedPages.join(', ')} failed to upload. </>}
              {pendingCount} of {uploadedPages.length} pages still need uploading.
              Click <strong>Publish</strong> or <strong>Save as draft</strong> to retry; pages already uploaded won&apos;t be sent again.
            </div>
          )}

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

        </div>
 
        {/* RIGHT — sticky panel */}
        <div className="w-72 shrink-0 hidden lg:block" style={{ alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
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
 
            {/* Series summary */}
            <Card>
              <CardLabel n="01" title="Series summary" />
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                {/* Cover */}
                <div style={{ width: 72, height: 100, borderRadius: 6, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--ryu-surface-3)', border: '1px solid var(--ryu-border)' }}>
                  {seriesData.coverPreview
                    ? <Image src={seriesData.coverPreview} alt="Cover" fill className="object-cover" />
                    : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 6, background: 'linear-gradient(to bottom, #3D1A0E, #7C2D12)' }}>
                        <p style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{seriesData.title || 'Untitled'}</p>
                      </div>
                    )
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="font-heading" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: 'var(--ryu-text)', marginBottom: 4, overflowWrap: 'anywhere' }}>{seriesData.title || 'Untitled'}</h2>
                  <p style={{ fontSize: 12, color: 'var(--ryu-text-2)' }}>
                    {seriesData.genre} · {seriesData.status.charAt(0).toUpperCase() + seriesData.status.slice(1)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: seriesData.description ? 12 : 0 }}>
                {[
                  { label: 'CHAPTERS', value: '1' },
                  { label: 'PAGES',    value: String(uploadedPages.length) },
                  { label: 'URL',      value: `/${seriesData.slug}` },
                  { label: 'STATUS',   value: 'Draft', highlight: true },
                ].map(item => (
                  <div key={item.label} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-2)', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ryu-text-3)', letterSpacing: 0.8, marginBottom: 3 }}>{item.label}</div>
                    <div title={item.value} style={{ fontSize: 13, fontWeight: 700, color: item.highlight ? 'var(--ryu-primary)' : 'var(--ryu-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {seriesData.description && (
                <div style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-2)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ryu-text-3)', letterSpacing: 0.8, marginBottom: 5 }}>SYNOPSIS</div>
                  <p className="line-clamp-3" style={{ fontSize: 12, color: 'var(--ryu-text-2)', lineHeight: 1.5, margin: 0 }}>{seriesData.description}</p>
                </div>
              )}
            </Card>
 
          </div>
        </div>
      </div>
 
      <div style={BOTTOM_BAR}>
        {/* Hide back + draft buttons while publishing; back is locked once rows exist */}
        {!publishing && !hasSavedRows && (
          <button onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text-2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={15} /> Back to chapter
          </button>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: publishing || hasSavedRows ? 'auto' : 0 }}>
          {!publishing && (
            <button onClick={onSaveDraft}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              Save as draft
            </button>
          )}
          <button disabled={publishing} onClick={onPublish}
            style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid #15803D', background: '#16A34A', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: publishing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}>
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {publishing ? 'Publishing...' : 'Publish series now'}
          </button>
        </div>
      </div>
    </>
  )
}