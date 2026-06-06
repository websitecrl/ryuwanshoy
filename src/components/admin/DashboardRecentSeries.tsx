'use client'

import Link from 'next/link'

type RecentSeries = {
  id: string
  title: string
  genre: string | null
  status: string | null
  created_at: string | null
}

export default function DashboardRecentSeries({ series }: { series: RecentSeries[] }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--ryu-border)',
        boxShadow: '0 1px 0 rgba(120,80,30,0.04)',
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--ryu-surface-3)', borderBottom: '1px solid var(--ryu-border)' }}>
            {['Title', 'Genre', 'Status', 'Created'].map(h => (
              <th
                key={h}
                className="text-left px-5 py-3 font-semibold font-mono-ryu text-[10.5px] tracking-widest uppercase"
                style={{ color: 'var(--ryu-text-2)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-10 text-center text-sm"
                style={{ color: 'var(--ryu-text-3)', background: 'var(--ryu-surface-1)' }}
              >
                No series yet — create your first one above.
              </td>
            </tr>
          ) : (
            series.map((s, i) => (
              <tr
                key={s.id}
                style={{
                  background: 'var(--ryu-surface-1)',
                  borderBottom: i < series.length - 1
                    ? '1px solid var(--ryu-border-soft)'
                    : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--ryu-surface-1)'
                }}
              >
                <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--ryu-text)' }}>
                  {s.title}
                </td>
                <td className="px-5 py-3.5" style={{ color: 'var(--ryu-text-2)' }}>
                  {s.genre ?? '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={
                      s.status === 'ongoing'
                        ? { background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }
                        : s.status === 'completed'
                        ? { background: 'var(--ryu-primary-soft)', color: '#9A3412', border: '1px solid #FED7AA' }
                        : { background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-2)', border: '1px solid var(--ryu-border)' }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          s.status === 'ongoing'   ? '#16A34A' :
                          s.status === 'completed' ? 'var(--ryu-primary)' :
                          'var(--ryu-text-3)',
                      }}
                    />
                    {s.status ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono-ryu text-[11px]" style={{ color: 'var(--ryu-text-2)' }}>
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })
                    : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}