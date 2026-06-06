'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {LayoutDashboard, BookOpen, BookMarked, Image, Mail, Settings, LogOut, Cloud, FileEdit } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Series',    href: '/admin/series',    icon: BookOpen },
  { label: 'Chapters',  href: '/admin/chapters',  icon: BookMarked },
  { label: 'Drafts',    href: '/admin/drafts',    icon: FileEdit},
  { label: 'Posts',     href: '/admin/posts',     icon: Image },
  { label: 'Settings',  href: '/admin/settings',  icon: Settings },
]

const isEAEnabled = process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true'

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [storage, setStorage] = useState<{
  usedGB: number
  totalGB: number 
  percentUsed: number
} | null>(null)

  const [siteTitle, setSiteTitle] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)
  // ── Theme toggle ───────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false)
  const [draftCount, setDraftCount] = useState<number>(0)

useEffect(() => {
  // Initial fetch
  fetch('/api/drafts')
    .then(r => r.json())
    .then(data => { if (data.count !== undefined) setDraftCount(data.count) })
    .catch(() => {})

  // Realtime
  const channel = supabase
    .channel('drafts-count')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chapters' },
      () => {
        fetch('/api/drafts')
          .then(r => r.json())
          .then(data => { if (data.count !== undefined) setDraftCount(data.count) })
          .catch(() => {})
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])

// Theme — runs once on mount
useEffect(() => {
  const saved = localStorage.getItem('ryu-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const startDark = saved ? saved === 'dark' : prefersDark
  setIsDark(startDark)
  document.documentElement.classList.toggle('dark', startDark)
}, [])

// R2 storage — runs once on mount
useEffect(() => {
  fetch('/api/r2-storage')
    .then(r => r.json())
    .then(data => {
      if (data.usedGB !== undefined) setStorage(data)
    })
    .catch(() => {})
}, [])

useEffect(() => {
  function loadSettings() {
  fetch('/api/settings', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      console.log('SIDEBAR SETTINGS RESPONSE:', data)
      const s = data.settings ?? data
      setSiteTitle(s.site_title ?? '')
      setLogoUrl(s.logo_url ?? null)
    })
    .catch(() => {})
  }
    loadSettings()
    window.addEventListener('settings-updated', loadSettings)
    return () => window.removeEventListener('settings-updated', loadSettings)
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('ryu-theme', next ? 'dark' : 'light')
  }

  // ── Nav helpers ────────────────────────────────────────────────────────
  function isActive(href: string) {
    return pathname.startsWith(href)
  }

  async function handleLogout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = '/admin'
  }
    

  return (
    <aside
      className="w-64 shrink-0 flex flex-col sticky top-0 h-screen"
      style={{
        background: 'var(--ryu-sidebar)',
        borderRight: '1px solid var(--ryu-border)',
      }}
    >

      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: '1px solid var(--ryu-border)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: '#1C1917' }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={siteTitle} className="w-full h-full object-cover" />
          ) : (
            <span
              className="font-heading font-bold text-sm tracking-tight"
              style={{ color: '#FFFBF5' }}
            >
              {siteTitle ? siteTitle.slice(0, 2).toUpperCase() : '...'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div
            className="font-heading font-bold text-lg leading-none tracking-tight truncate"
            style={{ color: 'var(--ryu-text)' }}
          >
            {siteTitle}
          </div>
          <div
            className="font-mono-ryu text-[10px] tracking-widest uppercase mt-1"
            style={{ color: 'var(--ryu-text-2)' }}
          >
            Admin Panel
          </div>
        </div>
      </div> 

      {/* ── Workspace label + theme toggle ────────────────────────────── */}
      <div className="flex items-center gap-5 px-5 pt-4 pb-3">
        <span
          className="font-mono-ryu text-[10px] tracking-widest uppercase flex-1"
          style={{ color: 'var(--ryu-text-3)' }}
        >
          Workspace
        </span>

        {/* Sun / Moon pill */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          className="flex items-center rounded-full p-[3px] cursor-pointer"
          style={{
            background: 'var(--ryu-surface-1)',
            border: '1px solid var(--ryu-border)',
          }}
        >
          {/* Sun */}
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200"
            style={{
              background: !isDark ? 'var(--ryu-primary)' : 'transparent',
              color:      !isDark ? '#fff' : 'var(--ryu-text-2)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
          </span>
          {/* Moon */}
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200"
            style={{
              background: isDark ? 'var(--ryu-accent)' : 'transparent',
              color:      isDark ? '#713F12' : 'var(--ryu-text-2)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
            </svg>
          </span>
        </button>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100"
              style={{
                background: active ? 'rgba(249,115,22,0.10)' : 'transparent',
                color:      active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.05)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Left accent bar */}
              <span
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-colors duration-100"
                style={{ background: active ? 'var(--ryu-primary)' : 'transparent' }}
              />
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.75}
                style={{ color: active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text-2)' }}
              />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}

        {/* Early Access — behind feature flag */}
        {isEAEnabled && (() => {
          const active = isActive('/admin/early-access')
          return (
            <Link
              href="/admin/early-access"
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100"
              style={{
                background: active ? 'rgba(249,115,22,0.10)' : 'transparent',
                color:      active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.05)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                style={{ background: active ? 'var(--ryu-primary)' : 'transparent' }}
              />
              <Mail
                size={18}
                strokeWidth={active ? 2 : 1.75}
                style={{ color: active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text-2)' }}
              />
              <span className="flex-1">Early Access</span>
            </Link>
          )
        })()}
      </nav>

      {/* ── Cloudflare R2 storage chip ─────────────────────────────────── */}
      <div className="mx-3 mb-3 p-3 rounded-xl" style={{
        background: 'var(--ryu-surface-1)',
        border: '1px solid var(--ryu-border)',
      }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
          >
            <Cloud size={13} />
          </span>
          <span className="text-xs font-semibold flex-1" style={{ color: 'var(--ryu-text)' }}>
            Cloudflare R2
          </span>
          <span className="font-mono-ryu text-[10px]" style={{ color: 'var(--ryu-text-2)' }}>
            {storage? `${storage.percentUsed}%` : '...'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ryu-border-soft)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: storage ? `${storage.percentUsed}%` : '0%' } }
          />
        </div>
        <div className="text-[11px] mt-1.5" style={{ color: 'var(--ryu-text-2)' }}>
          {storage ? `${storage.usedGB} / ${storage.totalGB} GB used`: 'Loading...'}
        </div>
      </div>

      {/* ── User chip / logout ─────────────────────────────────────────── */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--ryu-border)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 px-3 py-2.5 mt-3 rounded-xl text-left transition-colors duration-100 group cursor-pointer"
          style={{ border: '1px solid transparent' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--ryu-surface-1)'
            el.style.borderColor = 'var(--ryu-border)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.borderColor = 'transparent'
          }}
        >
          {/* Avatar */}
         <div className="flex items-center gap-1.5" style={{ color: '#DC2626' }}>
            <LogOut size={14} />
            <span className="text-[11px] font-semibold">Log out</span>
          </div>
        </button>
      </div>

    </aside>
  )
}