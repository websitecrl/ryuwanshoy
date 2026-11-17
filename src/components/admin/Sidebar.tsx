'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isWizardSaving, subscribeWizardSaving } from '@/lib/wizard-saving'
import ThemeToggle from '@/components/shared/ThemeToggle'
import { STORAGE_UPDATED_EVENT } from '@/components/admin/StorageCleanup'
import {LayoutDashboard, BookOpen, BookMarked, Image, Mail, Settings, LogOut, Cloud, FileEdit, MessageSquare, Menu } from 'lucide-react'

const navItems = [
  { label: 'Dashboard',     href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Series',        href: '/admin/series',    icon: BookOpen },
  { label: 'Chapters',      href: '/admin/chapters',  icon: BookMarked },
  { label: 'Illustration',  href: '/admin/posts',     icon: Image },
  { label: 'Drafts',        href: '/admin/drafts',    icon: FileEdit},
  { label: 'Feedback',      href: '/admin/feedback',  icon: MessageSquare },
  { label: 'Settings',      href: '/admin/settings',  icon: Settings },
]

const isEAEnabled = process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true'

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()

  const [storage, setStorage] = useState<{
  usedGB: number
  totalGB: number 
  percentUsed: number
} | null>(null)

  const [siteTitle, setSiteTitle] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [draftCount, setDraftCount] = useState<number>(0)

  // Phone drawer (under 768px; on desktop the sidebar is always visible).
  // Stores the path the drawer was opened on, so any route change closes it
  // without an effect: link tap, back button, redirect.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const drawerOpen = openedOn === pathname
  const drawerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // While the drawer is open: Esc closes it, the page behind doesn't scroll,
  // and widening the window past the phone breakpoint closes it (the menu
  // button is hidden there, so nothing else could).
  useEffect(() => {
    if (!drawerOpen) return
    const menuButton = menuButtonRef.current
    const close = () => setOpenedOn(null)
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const desktop = window.matchMedia('(min-width: 48rem)')
    const onBreakpoint = () => { if (desktop.matches) close() }

    const pageOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onBreakpoint)
    drawerRef.current?.focus()

    return () => {
      document.body.style.overflow = pageOverflow
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onBreakpoint)
      // back to where the keyboard user was (no-op when the button is hidden)
      menuButton?.focus()
    }
  }, [drawerOpen])

useEffect(() => {
  // wizard publishing -> skip (its rows look like drafts until the end)
  function refreshDrafts() {
    if (isWizardSaving()) return
    fetch('/api/drafts')
      .then(r => r.json())
      .then(data => { if (data.count !== undefined && !isWizardSaving()) setDraftCount(data.count) })
      .catch(() => {})
  }

  refreshDrafts()

  const channel = supabase
    .channel('drafts-count')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chapters' },
      refreshDrafts
    )
    .subscribe()

  // publishing ends -> refresh once
  const unsubscribe = subscribeWizardSaving(saving => { if (!saving) refreshDrafts() })

  return () => { supabase.removeChannel(channel); unsubscribe() }
}, [])

// R2 storage: on mount + after a Settings cleanup
useEffect(() => {
  function loadStorage() {
    fetch('/api/r2-storage')
      .then(r => r.json())
      .then(data => {
        if (data.usedGB !== undefined) setStorage(data)
      })
      .catch(() => {})
  }
  loadStorage()
  window.addEventListener(STORAGE_UPDATED_EVENT, loadStorage)
  return () => window.removeEventListener(STORAGE_UPDATED_EVENT, loadStorage)
}, [])

useEffect(() => {
  function loadSettings() {
  fetch('/api/settings', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
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

  function isActive(href: string) {
    return pathname.startsWith(href)
  }

  async function handleLogout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = '/admin'
  }
    

  return (
    <>
    {/* phones only: top bar with the menu button (the sidebar itself is the drawer) */}
    <header
      className="md:hidden sticky top-0 z-30 flex items-center gap-1 h-14 px-1.5 shrink-0"
      style={{ background: 'var(--ryu-sidebar)', borderBottom: '1px solid var(--ryu-border)' }}
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpenedOn(pathname)}
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="admin-sidebar"
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg cursor-pointer"
        style={{ color: 'var(--ryu-text)' }}
      >
        <Menu size={22} />
      </button>
      <span
        className="font-heading font-bold text-base tracking-tight truncate"
        style={{ color: 'var(--ryu-text)' }}
      >
        {siteTitle || 'Admin'}
      </span>
      {draftCount > 0 && (
        <Link
          href="/admin/drafts"
          className="ml-auto mr-1.5 shrink-0 flex items-center h-11 px-2 text-xs font-semibold"
          style={{ color: 'var(--ryu-text-2)' }}
        >
          {draftCount} draft{draftCount !== 1 ? 's' : ''}
        </Link>
      )}
    </header>

    {drawerOpen && (
      <div className="admin-backdrop md:hidden" aria-hidden="true" onClick={() => setOpenedOn(null)} />
    )}

    {/* admin-sidebar: a drawer under 768px (rules in globals.css, "Admin on phones") */}
    <aside
      id="admin-sidebar"
      ref={drawerRef}
      tabIndex={-1}
      aria-label="Admin navigation"
      data-open={drawerOpen}
      // a tap on any link closes the drawer, including the link to the current page
      onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpenedOn(null) }}
      className="admin-sidebar w-64 shrink-0 flex flex-col sticky top-0 h-screen outline-none"
      style={{
        background: 'var(--ryu-sidebar)',
        borderRight: '1px solid var(--ryu-border)',
      }}
    >

      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: '1px solid var(--ryu-border)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: 'var(--ryu-text)' }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={siteTitle} className="w-full h-full object-cover" />
          ) : (
            <span
              className="font-heading font-bold text-sm tracking-tight"
              style={{ color: 'var(--ryu-bg)' }}
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

      <div className="flex items-center gap-5 px-5 pt-4 pb-3">
        <span
          className="font-mono-ryu text-[10px] tracking-widest uppercase flex-1"
          style={{ color: 'var(--ryu-text-3)' }}
        >
          Workspace
        </span>

        <ThemeToggle />
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 px-3 py-2.5 max-md:min-h-11 rounded-lg text-sm font-medium transition-colors duration-100"
              style={{
                background: active ? 'color-mix(in srgb, var(--ryu-primary) 10%, transparent)' : 'transparent',
                color:      active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--ryu-primary) 5%, transparent)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span
                className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full transition-colors duration-100"
                style={{ background: active ? 'var(--ryu-primary)' : 'transparent' }}
              />
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.75}
                style={{ color: active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text-2)' }}
              />
              <span className="flex-1">{label}</span>
              {label === 'Drafts' && draftCount > 0 && (
                <span
                  className="flex items-center justify-center font-mono-ryu text-[10px] font-bold rounded-full shrink-0"
                  style={{
                    minWidth: 18, height: 18, padding: '0 5px',
                    background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)',
                  }}
                >
                  {draftCount}
                </span>
              )}
            </Link>
          )
        })}

        {isEAEnabled && (() => {
          const active = isActive('/admin/early-access')
          return (
            <Link
              href="/admin/early-access"
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100"
              style={{
                background: active ? 'color-mix(in srgb, var(--ryu-primary) 10%, transparent)' : 'transparent',
                color:      active ? 'var(--ryu-primary-deep)' : 'var(--ryu-text)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--ryu-primary) 5%, transparent)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span
                className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full"
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

      <div className="mx-3 mb-3 p-3 rounded-xl" style={{
        background: 'var(--ryu-surface-1)',
        border: '1px solid var(--ryu-border)',
      }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--ryu-accent)', color: 'var(--ryu-on-accent)' }}
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

      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--ryu-border)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 px-3 py-2.5 max-md:min-h-11 mt-3 rounded-xl text-left transition-colors duration-100 group cursor-pointer"
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
         <div className="flex items-center gap-1.5" style={{ color: 'var(--ryu-danger)' }}>
            <LogOut size={14} />
            <span className="text-[11px] font-semibold">Log out</span>
          </div>
        </button>
      </div>

    </aside>
    </>
  )
}