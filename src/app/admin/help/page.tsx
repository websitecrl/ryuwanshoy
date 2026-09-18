import Link from 'next/link'
import {
  ArrowLeft, Info, HeartHandshake, Link2, Star, Shield,
  LayoutDashboard, BookOpen, BookMarked, Image as ImageIcon, FileEdit,
} from 'lucide-react'

// Static reference content — nothing here reads from the database, so this
// page stays a plain server component. It exists because the Settings
// sub-nav has always pointed to "the help center" without one actually
// existing; this is that destination.

const isEAEnabled = process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED === 'true'

type SettingsDocSection = {
  key: string
  label: string
  Icon: typeof Info
  danger?: boolean
  items: { term: string; body: string }[]
}

const SETTINGS_DOCS: SettingsDocSection[] = [
  {
    key: 'site', label: 'Site info', Icon: Info,
    items: [
      { term: 'Logo', body: 'Shown in the navbar, footer, and the About card on the homepage. PNG keeps a transparent background from flattening to black.' },
      { term: 'Site Title', body: 'Appears in the browser tab and in link previews when the site is shared.' },
      { term: 'Creator Name', body: 'Shown next to the logo in the About section on the homepage.' },
      { term: 'SEO Description', body: 'Used by search engines and social link previews (Facebook, Twitter/X) — keep it under ~160 characters.' },
    ],
  },
  {
    key: 'donations', label: 'Donations', Icon: HeartHandshake,
    items: [
      { term: 'Ko-fi / Patreon URL', body: 'Rendered as buttons on the Donate page and in chapter footers. Leave a field blank to hide that button.' },
      { term: 'Donation Message', body: 'A short thank-you note shown to supporters on the Donate page.' },
      { term: 'Where the money goes', body: 'Directly to you through Ko-fi/Patreon — the site never takes a cut or touches the transaction.' },
    ],
  },
  {
    key: 'social', label: 'Social links', Icon: Link2,
    items: [
      { term: 'Facebook / Instagram / Twitter / TikTok / YouTube', body: 'Shown in the site footer and on every series page. A platform shows "Connected" once its URL is saved; leaving it blank hides that icon entirely.' },
    ],
  },
  ...(isEAEnabled ? [{
    key: 'early', label: 'Early access', Icon: Star,
    items: [
      { term: 'Headline / Subtext', body: 'The copy shown on the /early-access signup page — this only edits text.' },
      { term: 'Locking a chapter', body: 'Done per-chapter in the chapter editor, not here — this section only controls the signup page wording.' },
    ],
  }] : []),
  {
    key: 'danger', label: 'Danger zone', Icon: Shield, danger: true,
    items: [
      { term: 'Change Admin Email', body: 'Sends a confirmation link to the new address — the change only takes effect once that link is clicked.' },
      { term: 'Change Admin Password', body: 'Minimum 8 characters. You\'ll need the new password on your next login, so save it somewhere safe first.' },
    ],
  },
]

const OTHER_AREAS = [
  { label: 'Dashboard',    href: '/admin/dashboard', icon: LayoutDashboard, body: 'Publish metrics, and the hero banner slides shown at the top of the homepage.' },
  { label: 'Series',       href: '/admin/series',    icon: BookOpen,        body: 'Create and edit series — title, cover, genre, status.' },
  { label: 'Chapters',     href: '/admin/chapters',  icon: BookMarked,      body: 'Create chapters and upload/reorder their pages.' },
  { label: 'Illustration', href: '/admin/posts',     icon: ImageIcon,       body: 'Sketches, memes, and other posts outside the chapter structure.' },
  { label: 'Drafts',       href: '/admin/drafts',    icon: FileEdit,        body: 'Anything not yet published — series or chapters — lives here until it goes live.' },
]

export default function AdminHelpPage() {
  return (
    <div className="p-8 animate-page-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/settings"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ryu-text-2)', textDecoration: 'none', marginBottom: 14 }}
        >
          <ArrowLeft size={13} />
          Back to Settings
        </Link>
        <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>Workspace · Documentation</div>
        <h1 className="font-heading font-bold" style={{ fontSize: 38, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: 0 }}>Help center</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ryu-text-2)', maxWidth: 640 }}>
          What each Settings field does, and where to go for everything else in the dashboard.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>

        {/* ── Settings field reference ── */}
        {SETTINGS_DOCS.map(section => (
          <div key={section.key} style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: section.danger ? '#FEE2E2' : 'rgba(249,115,22,0.10)',
                color: section.danger ? '#DC2626' : 'var(--ryu-primary-deep)',
              }}>
                <section.Icon size={15} />
              </span>
              <h2 className="font-heading font-semibold" style={{ fontSize: 18, letterSpacing: -0.2, color: 'var(--ryu-text)', margin: 0 }}>{section.label}</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {section.items.map(item => (
                <div key={item.term} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ryu-text)' }}>{item.term}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ryu-text-2)' }}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Elsewhere in admin ── */}
        <div style={{ background: 'var(--ryu-surface-1)', border: '1px solid var(--ryu-border)', borderRadius: 12, padding: 24 }}>
          <div className="font-mono-ryu text-[10.5px] tracking-widest uppercase mb-1" style={{ color: 'var(--ryu-primary-deep)' }}>Quick nav</div>
          <div className="font-heading font-semibold mb-4" style={{ fontSize: 18, letterSpacing: -0.2, color: 'var(--ryu-text)' }}>Elsewhere in admin</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {OTHER_AREAS.map(area => (
              <Link
                key={area.href}
                href={area.href}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 8px',
                  borderRadius: 8, textDecoration: 'none',
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--ryu-surface-2)', color: 'var(--ryu-primary-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <area.icon size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ryu-text)' }}>{area.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ryu-text-2)' }}>{area.body}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
