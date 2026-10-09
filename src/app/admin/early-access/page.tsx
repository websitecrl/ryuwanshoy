'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, Search, Mail } from 'lucide-react'
import DeleteButton from '@/components/admin/DeleteButton'

type EarlyAccessEntry = {
  id: string; email: string; created_at: string
}

/**
 * One CSV cell: quoted (commas/quotes can't break columns) and, if it starts
 * with = + - @ (or a tab/CR), prefixed with ' so Excel/Sheets show it as text
 * instead of running it as a formula (CSV injection).
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export default function EarlyAccessPage() {
  const [entries, setEntries]     = useState<EarlyAccessEntry[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)

  async function fetchEntries() {
    try {
      const res  = await fetch('/api/early-access')
      // The route returns { emails: [...] } (this used to store the whole
      // object and crash on .filter).
      const json = await res.json() as { emails?: EarlyAccessEntry[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to load signups')
      setEntries(json.emails ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load signups')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEntries() }, [])

  const filtered = entries.filter(e => e.email.toLowerCase().includes(search.toLowerCase()))

  // Throws on failure; DeleteButton keeps its dialog open and shows the error
  // (replaces window.confirm + alert, which the design system forbids).
  async function handleDelete(id: string) {
    const res = await fetch(`/api/early-access/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(json.error ?? 'Failed to remove email')
    }
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function handleExportCSV() {
    const rows = entries.map(e =>
      [csvCell(e.email), csvCell(new Date(e.created_at).toLocaleDateString('en-PH'))].join(',')
    )
    const csv = ['Email,Date Signed Up', ...rows].join('\n')
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'early-access-emails.csv' })
    link.click(); URL.revokeObjectURL(link.href)
  }

  return (
    <div className="p-8 animate-page-in">

      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>
            Subscribers · {entries.length} {entries.length === 1 ? 'signup' : 'signups'}
          </div>
          <h1 className="font-heading font-bold leading-tight" style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)' }}>Early Access</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>Email list for early chapter access</p>
        </div>
        <button onClick={handleExportCSV} disabled={entries.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0"
          style={{ border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text)', cursor: 'pointer', opacity: entries.length === 0 ? 0.5 : 1 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ryu-text-3)', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email..."
          style={{ width: '100%', background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 8, padding: '10px 14px 10px 40px', fontSize: 14, color: 'var(--ryu-text)', fontFamily: 'inherit', outline: 'none' }} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(n => <div key={n} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl p-16 text-center"
          style={{ border: '1.5px dashed var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--ryu-primary-soft)', color: 'var(--ryu-primary-deep)' }}>
            <Mail size={26} />
          </span>
          <div className="font-heading font-semibold text-lg mb-1" style={{ color: 'var(--ryu-text)' }}>
            {search ? 'No emails match your search.' : 'No signups yet.'}
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ryu-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ryu-surface-3)', borderBottom: '1px solid var(--ryu-border)' }}>
                {['#', 'Email', 'Date Signed Up', 'Action'].map(h => (
                  <th key={h} className={`text-left px-5 py-3 font-semibold font-mono-ryu text-[10.5px] tracking-widest uppercase ${h === 'Action' ? 'text-right' : ''}`} style={{ color: 'var(--ryu-text-2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => (
                <tr key={entry.id} style={{ background: 'var(--ryu-surface-1)', borderBottom: idx < filtered.length - 1 ? '1px solid var(--ryu-border-soft)' : 'none' }}>
                  <td className="px-5 py-3.5 font-mono-ryu text-[11px]" style={{ color: 'var(--ryu-text-3)' }}>{idx + 1}</td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--ryu-text)' }}>{entry.email}</td>
                  <td className="px-5 py-3.5 font-mono-ryu text-[11px]" style={{ color: 'var(--ryu-text-2)' }}>
                    {new Date(entry.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <DeleteButton
                        label="Remove email"
                        title="Remove this email?"
                        description={`${entry.email} will be removed from the Early Access list. This cannot be undone.`}
                        confirmLabel="Remove"
                        successMessage="Email removed"
                        onConfirm={() => handleDelete(entry.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}