'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, HeartHandshake, Link2, Star, Shield, Info, Save, CheckCircle2 } from 'lucide-react'
import { compressImage } from '@/lib/image-compress'

const isEAEnabled = process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true'

type SettingsData = {
  id?: string; site_title?: string; creator_name?: string
  site_description?: string; logo_url?: string; kofi_url?: string
  patreon_url?: string; donation_message?: string
  facebook_url?: string; instagram_url?: string; twitter_url?: string
  tiktok_url?: string; youtube_url?: string; ea_headline?: string; ea_subtext?: string
}

const SECTIONS = [
  { key: 'site',      label: 'Site info',      Icon: Info },
  { key: 'donations', label: 'Donations',       Icon: HeartHandshake },
  { key: 'social',    label: 'Social links',    Icon: Link2 },
  { key: 'early',     label: 'Early access',    Icon: Star },
  { key: 'danger',    label: 'Danger zone',     Icon: Shield, danger: true },
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--ryu-surface-2)',
  border: '1px solid var(--ryu-border)', borderRadius: 6,
  padding: '10px 12px', fontSize: 14, color: 'var(--ryu-text)',
  fontFamily: 'inherit', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600,
  color: 'var(--ryu-text)', marginBottom: 6,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

export default function SettingsPage() {
  const supabase = createClient()
  const [section, setSection] = useState('site')
  const [settings, setSettings]   = useState<SettingsData>({})
  const [loading, setLoading]     = useState(true)
  const [savingSite, setSavingSite]         = useState(false)
  const [savingDonation, setSavingDonation] = useState(false)
  const [savingSocials, setSavingSocials]   = useState(false)
  const [savingEA, setSavingEA]             = useState(false)
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [savedSection, setSavedSection]     = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [newEmail, setNewEmail]         = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingEmail, setSavingEmail]       = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [dangerMsg, setDangerMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res  = await fetch('/api/settings')
        const data = await res.json()
        setSettings(data.settings ?? {})
      } catch (err) { console.error('Failed to fetch settings:', err) }
      finally { setLoading(false) }
    }
    fetchSettings()
  }, [])

  function flashSaved(key: string) {
    setSavedSection(key)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedSection(null), 2200)
  }

  async function handleSave(
    fields: Partial<SettingsData>,
    setSaving: (v: boolean) => void,
    sectionKey: string
  ) {
    setSaving(true)
    try {
      const res  = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setSettings(data.settings ?? data)
      window.dispatchEvent(new CustomEvent('settings-updated'))
      flashSaved(sectionKey)
    } catch (err) {
      console.error(err)
      setSavedSection('error:' + sectionKey)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSavedSection(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingLogo(true)
    try {
      // Logo only ever renders small — 800px is generous — and stays PNG
      // by default so a transparent logo doesn't get flattened to black.
      const imageBase64 = await compressImage(file, { maxDimension: 800 })

      const res  = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, type: 'logo' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      const newLogoUrl = data.url
      setSettings(p => ({ ...p, logo_url: newLogoUrl }))

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: newLogoUrl }),
      })

      window.dispatchEvent(new CustomEvent('settings-updated'))
      flashSaved('logo')
    } catch (err) {
      console.error('Logo upload failed:', err)
      setSavedSection('error:logo')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSavedSection(null), 3000)
    } finally {
      setUploadingLogo(false)
      const inp = document.getElementById('logo-upload') as HTMLInputElement
      if (inp) inp.value = ''
    }
  }

  async function handleEmailChange() {
    if (!newEmail || !confirmEmail) { setDangerMsg({ type: 'err', text: 'Please fill in both email fields.' }); return }
    if (newEmail !== confirmEmail)  { setDangerMsg({ type: 'err', text: 'Emails do not match.' }); return }
    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      setDangerMsg({ type: 'ok', text: 'Confirmation email sent. Check your new inbox.' })
      setNewEmail(''); setConfirmEmail('')
    } catch (err) { console.error(err); setDangerMsg({ type: 'err', text: 'Failed to update email.' }) }
    finally { setSavingEmail(false) }
  }

  async function handlePasswordChange() {
    if (!newPassword || !confirmPassword) { setDangerMsg({ type: 'err', text: 'Please fill in both password fields.' }); return }
    if (newPassword !== confirmPassword)  { setDangerMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    if (newPassword.length < 8)           { setDangerMsg({ type: 'err', text: 'Password must be at least 8 characters.' }); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setDangerMsg({ type: 'ok', text: 'Password updated successfully.' })
      setNewPassword(''); setConfirmPassword('')
    } catch (err) { console.error(err); setDangerMsg({ type: 'err', text: 'Failed to update password.' }) }
    finally { setSavingPassword(false) }
  }

  function SaveRow({
    onClick, saving, sectionKey, label, danger,
  }: {
    onClick: () => void
    saving: boolean
    sectionKey: string
    label: string
    danger?: boolean
  }) {
    const isError  = savedSection === 'error:' + sectionKey
    const isSaved  = savedSection === sectionKey
    const bg       = danger ? '#FEE2E2' : 'var(--ryu-primary)'
    const color    = danger ? '#DC2626' : '#fff'
    const border   = danger ? '1px solid #FECACA' : '1px solid var(--ryu-primary-deep)'

    return (
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onClick}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: bg, color, border, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={14} />
          {saving ? 'Saving...' : label}
        </button>

        {(isSaved || isError) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600,
            color: isError ? '#DC2626' : '#16A34A',
            animation: 'fadeIn 0.2s ease',
          }}>
            <CheckCircle2 size={15} />
            {isError ? 'Failed to save' : 'Saved'}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(n => (
          <div key={n} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 animate-page-in">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* Header */}
      <div className="mb-8">
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>Workspace · Configuration</div>
        <h1 className="font-heading font-bold" style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>Settings</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)' }}>Customize the public face of your site, donations, and admin access.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>

        {/* Sub-nav */}
        <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 12, alignSelf: 'start', position: 'sticky', top: 24 }}>
          {SECTIONS.filter(s => s.key !== 'early' || isEAEnabled).map(s => {
            const active = section === s.key
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', marginBottom: 2, fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: 'left', cursor: 'pointer', position: 'relative',
                  background: active ? (s.danger ? '#FEE2E2' : 'rgba(249,115,22,0.10)') : 'transparent',
                  color: active ? (s.danger ? '#DC2626' : 'var(--ryu-primary-deep)') : (s.danger ? '#DC2626' : 'var(--ryu-text)') }}>
                <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: '0 3px 3px 0', background: active ? (s.danger ? '#DC2626' : 'var(--ryu-primary)') : 'transparent' }} />
                <s.Icon size={15} />
                {s.label}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--ryu-border)', margin: '8px 4px 12px' }} />
          <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--ryu-text-2)' }}>
            <div style={{ fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 4 }}>Need help?</div>
            <div>Settings docs are in the help center.</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Site info ── */}
          {section === 'site' && (
            <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1" style={{ color: 'var(--ryu-primary-deep)' }}>Site info</div>
              <div className="font-heading font-semibold mb-1" style={{ fontSize: 22, letterSpacing: -0.3, color: 'var(--ryu-text)' }}>The basics</div>
              <p style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: 20 }}>What readers see on the homepage, search results, and social shares.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Logo field */}
                <div>
                  <label style={labelStyle}>Logo</label>
                  {settings.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logo_url} alt="Logo preview" style={{ height: 48, width: 'auto', borderRadius: 8, border: '1px solid var(--ryu-border)', objectFit: 'contain', marginBottom: 10, display: 'block' }} />
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={settings.logo_url ?? ''} onChange={e => setSettings(p => ({ ...p, logo_url: e.target.value }))} placeholder="Paste URL or upload →" />
                    <input type="file" accept="image/*" className="hidden" id="logo-upload" onChange={handleLogoUpload} />
                    <button type="button" disabled={uploadingLogo} onClick={() => document.getElementById('logo-upload')?.click()}
                      style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid var(--ryu-border)', background: 'var(--ryu-surface-2)', color: 'var(--ryu-text)', fontSize: 13.5, fontWeight: 600, cursor: uploadingLogo ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: uploadingLogo ? 0.6 : 1 }}>
                      {uploadingLogo ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  {(savedSection === 'logo' || savedSection === 'error:logo') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: savedSection === 'error:logo' ? '#DC2626' : '#16A34A', animation: 'fadeIn 0.2s ease' }}>
                      <CheckCircle2 size={13} />
                      {savedSection === 'error:logo' ? 'Upload failed' : 'Logo saved'}
                    </div>
                  )}
                </div>

                <Field label="Site Title"><input style={inputStyle} value={settings.site_title ?? ''} onChange={e => setSettings(p => ({ ...p, site_title: e.target.value }))} placeholder="My Comic Site" /></Field>
                <Field label="Creator Name"><input style={inputStyle} value={settings.creator_name ?? ''} onChange={e => setSettings(p => ({ ...p, creator_name: e.target.value }))} placeholder="Your name or pen name" /></Field>
                <Field label="SEO Description"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={settings.site_description ?? ''} onChange={e => setSettings(p => ({ ...p, site_description: e.target.value }))} placeholder="A short description of your comic site" /></Field>
              </div>

              <SaveRow
                onClick={() => handleSave({ site_title: settings.site_title, creator_name: settings.creator_name, site_description: settings.site_description, logo_url: settings.logo_url }, setSavingSite, 'site')}
                saving={savingSite}
                sectionKey="site"
                label="Save Site Info"
              />
            </div>
          )}

          {/* ── Donations ── */}
          {section === 'donations' && (
            <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1" style={{ color: 'var(--ryu-primary-deep)' }}>Donations</div>
              <div className="font-heading font-semibold mb-1" style={{ fontSize: 22, letterSpacing: -0.3, color: 'var(--ryu-text)' }}>Reader support</div>
              <p style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: 20 }}>Ko-fi and Patreon links appear on the donate page and chapter footers.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Ko-fi URL">
                    <input style={inputStyle} value={settings.kofi_url ?? ''}
                      onChange={e => setSettings(p => ({ ...p, kofi_url: e.target.value }))}
                      placeholder="https://ko-fi.com/yourname" />
                  </Field>
                  <Field label="Patreon URL">
                    <input style={inputStyle} value={settings.patreon_url ?? ''}
                      onChange={e => setSettings(p => ({ ...p, patreon_url: e.target.value }))}
                      placeholder="https://patreon.com/yourname" />
                  </Field>
                </div>
                <Field label="Donation Message">
                  <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                    value={settings.donation_message ?? ''}
                    onChange={e => setSettings(p => ({ ...p, donation_message: e.target.value }))}
                    placeholder="A thank you message for your supporters" />
                </Field>
              </div>

              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--ryu-accent)', border: '1px solid var(--ryu-accent-deep)', borderRadius: 8, fontSize: 12.5, color: '#713F12', display: 'flex', gap: 10 }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Donations are <strong>direct to you</strong>. Ryuwanshoy never takes a cut.</span>
              </div>

              <SaveRow
                onClick={() => handleSave({ kofi_url: settings.kofi_url, patreon_url: settings.patreon_url, donation_message: settings.donation_message }, setSavingDonation, 'donations')}
                saving={savingDonation}
                sectionKey="donations"
                label="Save Donation Info"
              />
            </div>
          )}

          {/* ── Social links ── */}
          {section === 'social' && (
            <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1" style={{ color: 'var(--ryu-primary-deep)' }}>Social links</div>
              <div className="font-heading font-semibold mb-1" style={{ fontSize: 22, letterSpacing: -0.3, color: 'var(--ryu-text)' }}>Where to find you</div>
              <p style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: 20 }}>Shown in the footer and on every series page.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { key: 'facebook_url',  label: 'Facebook',    placeholder: 'https://facebook.com/yourpage' },
                  { key: 'instagram_url', label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle' },
                  { key: 'twitter_url',   label: 'Twitter / X', placeholder: 'https://twitter.com/yourhandle' },
                  { key: 'tiktok_url',    label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle' },
                  { key: 'youtube_url',   label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel' },
                ] as { key: keyof SettingsData; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, alignItems: 'center' }}>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
                      <div style={{ fontSize: 11.5, color: settings[key] ? '#16A34A' : 'var(--ryu-text-3)' }}>{settings[key] ? 'Connected' : 'Not set'}</div>
                    </div>
                    <input style={inputStyle} value={(settings[key] as string) ?? ''} onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
                  </div>
                ))}
              </div>

              <SaveRow
                onClick={() => handleSave({ facebook_url: settings.facebook_url, instagram_url: settings.instagram_url, twitter_url: settings.twitter_url, tiktok_url: settings.tiktok_url, youtube_url: settings.youtube_url }, setSavingSocials, 'social')}
                saving={savingSocials}
                sectionKey="social"
                label="Save Social Links"
              />
            </div>
          )}

          {/* ── Early access ── */}
          {section === 'early' && isEAEnabled && (
            <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
              <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1" style={{ color: 'var(--ryu-primary-deep)' }}>Early access</div>
              <div className="font-heading font-semibold mb-1" style={{ fontSize: 22, letterSpacing: -0.3, color: 'var(--ryu-text)' }}>Reward your supporters</div>
              <p style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: 20 }}>Customize the early access signup page.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Headline"><input style={inputStyle} value={settings.ea_headline ?? ''} onChange={e => setSettings(p => ({ ...p, ea_headline: e.target.value }))} placeholder="Get Early Access" /></Field>
                <Field label="Subtext"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={settings.ea_subtext ?? ''} onChange={e => setSettings(p => ({ ...p, ea_subtext: e.target.value }))} placeholder="Sign up to read chapters before anyone else." /></Field>
              </div>
              <SaveRow
                onClick={() => handleSave({ ea_headline: settings.ea_headline, ea_subtext: settings.ea_subtext }, setSavingEA, 'early')}
                saving={savingEA}
                sectionKey="early"
                label="Save Early Access Text"
              />
            </div>
          )}

          {/* ── Danger zone ── */}
          {section === 'danger' && (
            <div style={{ background: 'linear-gradient(180deg, #FFF5F5, var(--background))', border: '1.5px solid #FECACA', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} /></span>
                <div>
                  <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase" style={{ color: '#DC2626', marginBottom: 2 }}>DANGER ZONE</div>
                  <div className="font-heading font-semibold" style={{ fontSize: 20, letterSpacing: -0.3, color: 'var(--ryu-text)' }}>Admin account</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ryu-text-2)', marginBottom: 20, marginLeft: 50 }}>These actions affect your admin login. Double-check before saving.</p>

              {dangerMsg && (
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                  background: dangerMsg.type === 'ok' ? '#F0FDF4' : '#FFF5F5',
                  border: `1px solid ${dangerMsg.type === 'ok' ? '#BBF7D0' : '#FECACA'}`,
                  color: dangerMsg.type === 'ok' ? '#16A34A' : '#DC2626' }}>
                  <CheckCircle2 size={14} />
                  {dangerMsg.text}
                </div>
              )}

              {/* Change email */}
              <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid #FECACA', borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 14 }}>Change Admin Email</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="New Email"><input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" /></Field>
                  <Field label="Confirm New Email"><input style={inputStyle} type="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} placeholder="new@email.com" /></Field>
                  <button onClick={handleEmailChange} disabled={savingEmail}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                    {savingEmail ? 'Sending confirmation...' : 'Change Email'}
                  </button>
                </div>
              </div>

              {/* Change password */}
              <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid #FECACA', borderRadius: 10, padding: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ryu-text)', marginBottom: 14 }}>Change Admin Password</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="New Password"><input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 characters" /></Field>
                  <Field label="Confirm New Password"><input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Min. 8 characters" /></Field>
                  <button onClick={handlePasswordChange} disabled={savingPassword}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                    {savingPassword ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}