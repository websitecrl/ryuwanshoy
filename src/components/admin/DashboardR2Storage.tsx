'use client'

import { useState, useEffect } from 'react'
import { Cloud } from 'lucide-react'

type StorageData = {
  usedGB: number
  totalGB: number
  percentUsed: number
}

export default function DashboardR2Storage() {
  const [storage, setStorage] = useState<StorageData | null>(null)

  useEffect(() => {
    fetch('/api/r2-storage')
      .then(r => r.json())
      .then(data => { if (data.usedGB !== undefined) setStorage(data) })
      .catch(() => {})
  }, [])

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{
        background: 'var(--ryu-surface-1)',
        border: '1px solid var(--ryu-border)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--ryu-accent)', color: '#713F12' }}
        >
          <Cloud size={14} />
        </span>
        <span
          className="font-mono-ryu text-[10px] tracking-widest uppercase"
          style={{ color: 'var(--ryu-text-3)' }}
        >
          Cloudflare R2 Storage
        </span>
      </div>

      <div className="mt-1">
        <span
          className="font-heading font-bold leading-none"
          style={{ fontSize: 36, letterSpacing: -1, color: 'var(--ryu-text)' }}
        >
          {storage ? storage.usedGB : '—'}
        </span>
        <span className="text-sm ml-1" style={{ color: 'var(--ryu-text-2)' }}>
          / {storage?.totalGB ?? 10} GB
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--ryu-border-soft)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: storage ? `${storage.percentUsed}%` : '0%',
            background: 'var(--ryu-primary)',
          }}
        />
      </div>

      <div className="text-xs" style={{ color: 'var(--ryu-text-2)' }}>
        {storage ? `${storage.percentUsed}% used` : 'Loading…'}
      </div>
    </div>
  )
}