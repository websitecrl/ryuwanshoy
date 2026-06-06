export default function Loading() {
  return (
    <div className="flex flex-col gap-10 pb-16">

      {/* Hero skeleton — full width, 300px, no border radius */}
      <div style={{ height: 300, width: '100%', background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />

      {/* Rest — constrained */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', width: '100%' }}
        className="flex flex-col gap-10"
      >

        {/* Continue bar skeleton */}
        <div style={{ height: 64, borderRadius: 12, background: 'var(--ryu-surface-2)', animation: 'pulse 2s infinite' }} />

        {/* Latest Releases skeleton */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--ryu-border)' }} />
            <div style={{ width: 140, height: 16, borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div style={{ aspectRatio: '3/4', borderRadius: 8, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
                <div style={{ height: 12, width: '75%', borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
                <div style={{ height: 10, width: '50%', borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Sketchbook skeleton */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--ryu-border)' }} />
            <div style={{ width: 180, height: 16, borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--ryu-border)' }}>
                <div style={{ aspectRatio: '4/3', background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
                <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
                  <div style={{ height: 12, width: '70%', borderRadius: 4, background: 'var(--ryu-surface-3)', animation: 'pulse 2s infinite' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}