'use client'

import Link from 'next/link'
import { BookOpen, BookMarked, Image, Settings } from 'lucide-react'

const quickTones: Record<string, { bg: string; fg: string }> = {
  orange: { bg: 'var(--ryu-primary-soft)', fg: '#9A3412' },
  teal:   { bg: '#CCFBF1',                 fg: '#0F766E' },
  yellow: { bg: 'var(--ryu-accent)',       fg: '#713F12' },
  pink:   { bg: '#FCE7F3',                 fg: '#9D174D' },
}

const quickActions = [
  { label: 'New Series',  sub: 'Start a new comic',      icon: BookOpen,   tone: 'orange', href: '/admin/series/new' },
  { label: 'New Chapter', sub: 'Add to existing series', icon: BookMarked, tone: 'teal',   href: '/admin/chapters/new' },
  { label: 'New Post',    sub: 'Announcement or sketch', icon: Image,      tone: 'yellow', href: '/admin/posts/new' },
  { label: 'Settings',    sub: 'Site & donations',       icon: Settings,   tone: 'pink',   href: '/admin/settings' },
]

export default function DashboardQuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {quickActions.map(({ label, sub, icon: Icon, tone, href }) => {
        const t = quickTones[tone] ?? { bg: 'var(--ryu-primary-soft)', fg: '#9A3412' }
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3.5 p-4 rounded-xl transition-all duration-150"
            style={{
              background: 'var(--ryu-surface-1)',
              border: '1px solid var(--ryu-border)',
              boxShadow: '0 1px 0 rgba(120,80,30,0.04), 0 4px 16px -8px rgba(120,80,30,0.08)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--ryu-primary)'
              el.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--ryu-border)'
              el.style.transform = 'none'
            }}
          >
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: t.bg, color: t.fg }}
            >
              <Icon size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--ryu-text)' }}>
                {label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--ryu-text-2)' }}>
                {sub}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}