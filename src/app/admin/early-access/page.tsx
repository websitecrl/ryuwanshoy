'use client'

import { useEffect, useState } from 'react'
import { Trash2, Download, Search, Mail } from 'lucide-react'

type EarlyAccessEntry = {
  id: string; email: string; created_at: string
}

export default function EarlyAccessPage() {
  const [entries, setEntries]     = useState<EarlyAccessEntry[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    try {
      const res  = await fetch('/api/early-access')
      const data = await res.json()
      setEntries(data)
    } catch (err) { console.error('Failed to fetch entries:', err) }
    finally { setLoading(false) }
  }

  const filtered = entries.filter(e => e.email.toLowerCase().includes(search.toLowerCase()))

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this email?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/early-access/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) { console.error(err); alert('Failed to delete. Please try again.') }
    finally { setDeletingId(null) }
  }

  function handleExportCSV() {
    const csv = ['Email,Date Signed Up', ...entries.map(e => `${e.email},${new Date(e.created_at).toLocaleDateString('en-PH')}`)].join('\n')
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
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center ml-auto transition-colors"
                      style={{ border: '1px solid var(--ryu-border-soft)', background: 'var(--ryu-surface-1)', color: 'var(--ryu-text-3)', cursor: 'pointer' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#FECACA'; el.style.background = '#FEF2F2'; el.style.color = '#DC2626' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--ryu-border-soft)'; el.style.background = 'var(--ryu-surface-1)'; el.style.color = 'var(--ryu-text-3)' }}>
                      <Trash2 size={14} />
                    </button>
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