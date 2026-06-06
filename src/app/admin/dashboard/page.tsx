
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import HeroBannerManager from '@/components/admin/HeroBannerManager'
import DashboardContent from '@/components/admin/DashboardContent'
import DashboardQuickCreate from '@/components/admin/DashboardQuickCreate'
import NotificationBell from '@/components/admin/NotificationBell'


async function getDashboardData() {
  const supabase = await createClient()

  const [seriesRes, draftsRes] = await Promise.all([
    supabase
      .from('series')
      .select('id, title, slug, genre, status, cover_image, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('chapters')
      .select(`
        id,
        title,
        chapter_number,
        created_at,
        series:series_id ( title, slug )
      `)
      .eq('is_draft', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    series: seriesRes.data ?? [],
    drafts: draftsRes.data ?? [],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin')

  const { series, drafts } = await getDashboardData()

  return (
    <div className="p-8 space-y-6 animate-page-in">
      {/* ── Header ──────────────────────────────────────────────────── */}
<div className="flex items-center justify-between gap-4">
  <div>
    <div
      className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2 flex items-center gap-2"
      style={{ color: 'var(--ryu-primary-deep)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
        style={{ background: '#16A34A' }}
      />
      {new Date().toLocaleDateString('en-PH', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })}
    </div>
    <h1
      className="font-heading font-bold leading-tight"
      style={{ fontSize: 40, letterSpacing: -0.8, color: 'var(--ryu-text)' }}
    >
      Dashboard
    </h1>
  </div>

  <NotificationBell />
</div>

      {/* ── Top row — Hero Banner + Right column ────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 280px' }}>

        {/* Hero Banner Manager */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--ryu-surface-1)',
            border: '1px solid var(--ryu-border)',
          }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid var(--ryu-border)' }}
          >
            <div
              className="font-mono-ryu text-[10px] tracking-widest uppercase"
              style={{ color: 'var(--ryu-text-3)' }}
            >
              Hero Banner
            </div>
            <div
              className="text-sm font-semibold mt-0.5"
              style={{ color: 'var(--ryu-text)' }}
            >
              Manage slides
            </div>
          </div>
          <div className="p-5">
            <HeroBannerManager />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Live Status */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'var(--ryu-surface-1)',
              border: '1px solid var(--ryu-border)',
            }}
          >
            <div
              className="font-mono-ryu text-[10px] tracking-widest uppercase mb-3"
              style={{ color: 'var(--ryu-text-3)' }}
            >
              Site Status
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full animate-pulse-dot"
                style={{ background: '#16A34A' }}
              />
              <span
                className="font-heading font-bold"
                style={{ fontSize: 22, letterSpacing: -0.4, color: 'var(--ryu-text)' }}
              >
                Live
              </span>
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--ryu-text-2)' }}>
              All systems go
            </div>
            <a
              href="https://ryuwanshoy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--ryu-primary-deep)' }}
            >
              <ExternalLink size={12} />
              ryuwanshoy.com
            </a>
          </div>

          {/* Quick Create — client component for hover effects */}
          <DashboardQuickCreate />
        </div>
      </div>

      {/* ── Bottom row — Series + Drafts (client component) ─────────── */}
      <DashboardContent
        series={series.map(s => ({
          id:          s.id,
          title:       s.title,
          slug:        s.slug ?? '',
          genre:       s.genre,
          status:      s.status,
          cover_image: s.cover_image,
        }))}
        drafts={drafts.map(d => ({
          id:             d.id,
          title:          d.title,
          chapter_number: d.chapter_number,
          series:         d.series as { title: string; slug: string } | null,
        }))}
      />

    </div>
  )
}