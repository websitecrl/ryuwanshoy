'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AtSign, ArrowRight, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react'

// Two modes:
// 'request' — user enters email, we send the reset link
// 'update'  — user landed from the email link, we show new password fields

type Mode = 'request' | 'update'

export default function ResetPasswordPage() {
  const [mode,       setMode]       = useState<Mode>('request')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [showCf,     setShowCf]     = useState(false)
  const [isLoading,  setIsLoading]  = useState(false)
  const [sent,       setSent]       = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // When Supabase redirects back with a recovery token, it sets the session
  // automatically via the URL hash. We just need to detect that we're in
  // recovery mode and switch to the 'update' form.
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Send reset email ────────────────────────────────────────────────────────
  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) return

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })

    setIsLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  // ── Update password ─────────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setIsLoading(false)
    if (error) {
      setError(error.message)
      return
    }

    setDone(true)
    // Redirect to login after 2s
    setTimeout(() => { window.location.href = '/admin' }, 2000)
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        .fade-up { animation: fadeUp 500ms cubic-bezier(.2,.6,.2,1) both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        minHeight: '100vh', width: '100%',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>

        {/* Background image */}
        <div style={{
          position: 'fixed', inset: 0,
          backgroundImage: 'url(/login.png)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat', zIndex: 0,
        }} />

        {/* Dark overlay */}
        <div style={{
          position: 'fixed', inset: 0,
          background: 'color-mix(in srgb, var(--ryu-shadow) 55%, transparent)', zIndex: 1,
        }} />

        {/* Card */}
        <div className="fade-up" style={{
          position: 'relative', zIndex: 2,
          width: '100%', maxWidth: 400,
          background: 'var(--ryu-bg)', borderRadius: 20,
          padding: '40px 36px',
          boxShadow: '0 32px 80px -16px color-mix(in srgb, var(--ryu-shadow) 55%, transparent), 0 0 0 1px color-mix(in srgb, var(--ryu-shadow) 6%, transparent)',
        }}>

          {/* ── MODE: request — enter email ──────────────────────────── */}
          {mode === 'request' && !sent && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'var(--ryu-warning-soft)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <KeyRound size={20} color="var(--ryu-warning)" />
                </div>
                <h2 style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 700,
                  fontSize: 28, letterSpacing: -0.6,
                  color: 'var(--ryu-text)', margin: 0,
                }}>
                  Reset your password
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--ryu-text-2)', marginTop: 8, lineHeight: 1.5 }}>
                  Enter your admin email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ryu-text)' }}>
                    Email <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', borderRadius: 8,
                      overflow: 'hidden', background: 'var(--ryu-surface-2)',
                      border: '1px solid var(--ryu-border)',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocusCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = '0 0 0 3px color-mix(in srgb, var(--ryu-primary) 14%, transparent)'
                    }}
                    onBlurCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-border)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = 'none'
                    }}
                  >
                    <span style={{ paddingLeft: 12, color: 'var(--ryu-text-2)', display: 'flex', alignItems: 'center' }}>
                      <AtSign size={15} />
                    </span>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="hello@ryuwanshoy.com" required disabled={isLoading}
                      style={{
                        flex: 1, background: 'transparent', padding: '11px 12px',
                        fontSize: 14, color: 'var(--ryu-text)', outline: 'none', border: 'none',
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <p style={{ fontSize: 13.5, textAlign: 'center', color: 'var(--ryu-danger)', margin: 0 }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit" disabled={isLoading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                    padding: '13px 20px', borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)',
                    border: '1px solid var(--ryu-primary-deep)',
                    boxShadow: '0 1px 0 color-mix(in srgb, var(--ryu-shadow) 6%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ryu-on-image) 15%, transparent)',
                    opacity: isLoading ? 0.65 : 1, transition: 'opacity 150ms',
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid color-mix(in srgb, var(--ryu-on-primary) 40%, transparent)',
                        borderTopColor: 'var(--ryu-on-primary)',
                        animation: 'spin 0.7s linear infinite', flexShrink: 0,
                      }} />
                      Sending…
                    </>
                  ) : (
                    <>Send reset link <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── MODE: request — email sent confirmation ──────────────── */}
          {mode === 'request' && sent && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'var(--ryu-success-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 24,
              }}>
                ✉️
              </div>
              <h2 style={{
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                fontSize: 26, letterSpacing: -0.5,
                color: 'var(--ryu-text)', margin: '0 0 10px',
              }}>
                Check your email
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ryu-text-2)', lineHeight: 1.6, margin: '0 0 24px' }}>
                We sent a reset link to <strong style={{ color: 'var(--ryu-text)' }}>{email}</strong>.
                Click the link in the email to set a new password.
              </p>
              <p style={{ fontSize: 12, color: 'var(--ryu-text-3)' }}>
                Didn't get it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ryu-primary-deep)', fontWeight: 600, padding: 0 }}
                >
                  try again
                </button>.
              </p>
            </div>
          )}

          {/* ── MODE: update — set new password ─────────────────────── */}
          {mode === 'update' && !done && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'var(--ryu-warning-soft)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <KeyRound size={20} color="var(--ryu-warning)" />
                </div>
                <h2 style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 700,
                  fontSize: 28, letterSpacing: -0.6,
                  color: 'var(--ryu-text)', margin: 0,
                }}>
                  Set new password
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--ryu-text-2)', marginTop: 8, lineHeight: 1.5 }}>
                  Choose a strong password for your studio.
                </p>
              </div>

              <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* New password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ryu-text)' }}>
                    New password <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', borderRadius: 8,
                      background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocusCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = '0 0 0 3px color-mix(in srgb, var(--ryu-primary) 14%, transparent)'
                    }}
                    onBlurCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-border)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = 'none'
                    }}
                  >
                    <input
                      type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" required disabled={isLoading}
                      style={{
                        flex: 1, background: 'transparent', padding: '11px 12px',
                        fontSize: 14, color: 'var(--ryu-text)', outline: 'none', border: 'none',
                      }}
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      style={{ paddingRight: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ryu-text-2)', display: 'flex', alignItems: 'center' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ryu-text)' }}>
                    Confirm password <span style={{ color: 'var(--ryu-primary)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', borderRadius: 8,
                      background: 'var(--ryu-surface-2)', border: '1px solid var(--ryu-border)',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocusCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-primary)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = '0 0 0 3px color-mix(in srgb, var(--ryu-primary) 14%, transparent)'
                    }}
                    onBlurCapture={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ryu-border)'
                      ;(e.currentTarget as HTMLElement).style.boxShadow  = 'none'
                    }}
                  >
                    <input
                      type={showCf ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password" required disabled={isLoading}
                      style={{
                        flex: 1, background: 'transparent', padding: '11px 12px',
                        fontSize: 14, color: 'var(--ryu-text)', outline: 'none', border: 'none',
                      }}
                    />
                    <button type="button" onClick={() => setShowCf(s => !s)}
                      style={{ paddingRight: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ryu-text-2)', display: 'flex', alignItems: 'center' }}>
                      {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p style={{ fontSize: 13.5, textAlign: 'center', color: 'var(--ryu-danger)', margin: 0 }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit" disabled={isLoading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                    padding: '13px 20px', borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: 'var(--ryu-primary)', color: 'var(--ryu-on-primary)',
                    border: '1px solid var(--ryu-primary-deep)',
                    boxShadow: '0 1px 0 color-mix(in srgb, var(--ryu-shadow) 6%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ryu-on-image) 15%, transparent)',
                    opacity: isLoading ? 0.65 : 1, transition: 'opacity 150ms',
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid color-mix(in srgb, var(--ryu-on-primary) 40%, transparent)',
                        borderTopColor: 'var(--ryu-on-primary)',
                        animation: 'spin 0.7s linear infinite', flexShrink: 0,
                      }} />
                      Updating…
                    </>
                  ) : (
                    <>Update password <ArrowRight size={16} /></>
                  )}
                </button>
                 <button
                    type="button"
                    onClick={() => setMode('request')}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6,
                        padding: '11px 20px', borderRadius: 10,
                        fontSize: 13.5, fontWeight: 500,
                        cursor: 'pointer', background: 'none',
                        border: '1px solid var(--ryu-border)', color: 'var(--ryu-text-2)',
                        transition: 'border-color 150ms, color 150ms',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--ryu-primary)'
                        e.currentTarget.style.color = 'var(--ryu-primary-deep)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--ryu-border)'
                        e.currentTarget.style.color = 'var(--ryu-text-2)'
                    }}
                    >
                    <ArrowLeft size={14} /> Back
                </button>
              </form>
            </>
          )}

          {/* ── MODE: update — success ───────────────────────────────── */}
          {mode === 'update' && done && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'var(--ryu-success-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 24,
              }}>
                ✅
              </div>
              <h2 style={{
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                fontSize: 26, letterSpacing: -0.5,
                color: 'var(--ryu-text)', margin: '0 0 10px',
              }}>
                Password updated!
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ryu-text-2)', lineHeight: 1.6 }}>
                Redirecting you back to the login page…
              </p>
            </div>
          )}

          {/* Back to login — shown on request mode only */}
          {mode === 'request' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--ryu-border)' }}>
              <a
                href="/admin"
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12.5, color: 'var(--ryu-text-2)', textDecoration: 'none', fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ryu-primary-deep)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ryu-text-2)')}
                >
                <ArrowLeft size={13} /> Back to login
                </a>
            </div>
          )}

        </div>
      </div>
    </>
  )
}