'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ArrowRight, AtSign, Lock } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shake,     setShake]     = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/admin/dashboard')
    })
    const saved = localStorage.getItem('ryu-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const startDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', startDark)
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setShake(true); setTimeout(() => setShake(false), 420); return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setIsLoading(false)
      setShake(true); setTimeout(() => setShake(false), 420)
      return
    }
    router.refresh()
    router.push('/admin/dashboard')
  }

  return (
    <>
      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake { animation: shakeX 380ms cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        .fade-up   { animation: fadeUp 500ms cubic-bezier(.2,.6,.2,1) both; }
        .fade-up-1 { animation-delay: 60ms; }
        .fade-up-2 { animation-delay: 130ms; }
        .fade-up-3 { animation-delay: 200ms; }
        .fade-up-4 { animation-delay: 270ms; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Full-screen background */}
      <div style={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}>

        {/* Background image */}
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'url(/login.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }} />

        {/* Dark overlay */}
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28, 25, 23, 0.55)',
          zIndex: 1,
        }} />

        {/* Centered form card */}
        <div
          className={shake ? 'shake' : ''}
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: 400,
            background: '#FFFBF5',
            borderRadius: 20,
            padding: '40px 36px',
            boxShadow: '0 32px 80px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >

          <h2
            className="fade-up"
            style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              fontSize: 32, letterSpacing: -0.7,
              marginTop: 0, marginBottom: 24,
              color: '#1C1917',
            }}
          >
            Sign in to your studio
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div className="fade-up fade-up-1">
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: '#1C1917' }}>
                Email <span style={{ color: 'var(--ryu-primary)' }}>*</span>
              </label>
              <div
                style={{
                  display: 'flex', alignItems: 'center', borderRadius: 8,
                  overflow: 'hidden', background: '#F5F0EB',
                  border: '1px solid #E7E0D8',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocusCapture={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow  = '0 0 0 3px rgba(249,115,22,0.14)'
                }}
                onBlurCapture={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E7E0D8'
                  ;(e.currentTarget as HTMLElement).style.boxShadow  = 'none'
                }}
              >
                <span style={{ paddingLeft: 12, color: '#78716C', display: 'flex', alignItems: 'center' }}>
                  <AtSign size={15} />
                </span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="hello@ryuwanshoy.com" required disabled={isLoading}
                  style={{
                    flex: 1, background: 'transparent', padding: '11px 12px',
                    fontSize: 14, color: '#1C1917', outline: 'none', border: 'none',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="fade-up fade-up-2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#1C1917' }}>
                  Password <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/admin/reset-password')}
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#78716C', padding: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary-deep)')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#78716C')}
                >
                  Forgot password?
                </button>
              </div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', borderRadius: 8,
                  background: '#F5F0EB',
                  border: '1px solid #E7E0D8',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocusCapture={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow  = '0 0 0 3px rgba(249,115,22,0.14)'
                }}
                onBlurCapture={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E7E0D8'
                  ;(e.currentTarget as HTMLElement).style.boxShadow  = 'none'
                }}
              >
                <span style={{ paddingLeft: 12, color: '#78716C', display: 'flex', alignItems: 'center' }}>
                  <Lock size={14} />
                </span>
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Your admin password" required disabled={isLoading}
                  style={{
                    flex: 1, background: 'transparent', padding: '11px 12px',
                    fontSize: 14, color: '#1C1917', outline: 'none', border: 'none',
                  }}
                />
                <button
                  type="button" onClick={() => setShowPw(s => !s)}
                  style={{
                    paddingRight: 12, background: 'none', border: 'none',
                    cursor: 'pointer', color: '#78716C',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: 13.5, textAlign: 'center', color: '#DC2626', margin: 0 }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <div className="fade-up fade-up-3" style={{ paddingTop: 4 }}>
              <button
                type="submit" disabled={isLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  padding: '13px 20px', borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  background: 'var(--ryu-primary)', color: '#fff',
                  border: '1px solid var(--ryu-primary-deep)',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
                  opacity: isLoading ? 0.65 : 1, transition: 'opacity 150ms',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff',
                      animation: 'spin 0.7s linear infinite', flexShrink: 0,
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign in to admin <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div
            className="fade-up fade-up-4"
            style={{
              marginTop: 28, paddingTop: 20,
              borderTop: '1px dashed #E7E0D8',
              fontSize: 12, color: '#78716C',
            }}
          >
            <span>
              Not staff?{' '}
              <a href="/" style={{ fontWeight: 600, color: 'var(--ryu-primary-deep)' }}>
                Read at ryuwanshoy.com →
              </a>
            </span>
          </div>

        </div>
      </div>
    </>
  )
}