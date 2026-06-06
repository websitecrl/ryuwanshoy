'use client'

import Link from 'next/link'
import { BookOpen, BookMarked, Image } from 'lucide-react'

const actions = [
  { label: 'New Series',  icon: BookOpen,   href: '/admin/series/new',   bg: 'var(--ryu-primary-soft)', fg: '#9A3412' },
  { label: 'New Chapter', icon: BookMarked, href: '/admin/chapters/new', bg: '#CCFBF1',                 fg: '#0F766E' },
  { label: 'New Post',    icon: Image,      href: '/admin/posts/new',    bg: 'var(--ryu-accent)',       fg: '#713F12' },
]

export default function DashboardQuickCreate() {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{
        background: 'var(--ryu-surface-1)',
        border: '1px solid var(--ryu-border)',
      }}
    >
      <div
        className="font-mono-ryu text-[10px] tracking-widest uppercase mb-1"
        style={{ color: 'var(--ryu-text-3)' }}
      >
        Quick Create
      </div>

      {actions.map(({ label, icon: Icon, href, bg, fg }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-100"
          style={{
            background: 'var(--ryu-surface-2)',
            border: '1px solid var(--ryu-border)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--ryu-primary)'
            el.style.background  = 'var(--ryu-surface-3)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--ryu-border)'
            el.style.background  = 'var(--ryu-surface-2)'
          }}
        >
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: bg, color: fg }}
          >
            <Icon size={14} />
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--ryu-text)' }}>
            {label}
          </span>
        </Link>
      ))}
    </div>
  )
}