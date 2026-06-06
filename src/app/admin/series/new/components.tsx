'use client'

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 22, boxShadow: '0 1px 0 rgba(120,80,30,0.04)' }}>
      {children}
    </div>
  )
}

export function CardLabel({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '1px dashed var(--ryu-border)' }}>
      <span className="font-mono-ryu" style={{ fontSize: 10, color: 'var(--ryu-primary-deep)', letterSpacing: 1, fontWeight: 600 }}>{n}</span>
      <span className="font-heading" style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2, color: 'var(--ryu-text)' }}>{title}</span>
    </div>
  )
}