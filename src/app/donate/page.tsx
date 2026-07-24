'use client'

import { SiPatreon } from 'react-icons/si'
import { SiKofi } from 'react-icons/si'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import type { Database } from '@/types/database'

type Settings = Database['public']['Tables']['settings']['Row']

const FAQ_ITEMS = [
  {
    q: 'Do I have to pay to read?',
    a: "Nope, never. Everything here is free, full resolution, no paywall, no ads. Supporting is just for folks who want to leave something in the tip jar — that's really all it is.",
  },
  {
    q: 'What do I get for supporting monthly?',
    a: "You'll get chapters about a week before everyone else, access to the WIP feed where I post rough pages and process shots, and a small credit on the back-matter page if you'd like one.",
  },
  {
    q: 'Where does the money actually go?',
    a: 'Mostly software (Clip Studio, hosting, Cloudflare), printing for conventions, and buying myself one extra evening a week to draw instead of taking on freelance work. That covers it.',
  },
]

// ─── Ko-fi card ───────────────────────────────────────────────────────────────
function KofiCard({ url }: { url: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ border: '0.5px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5" style={{ background: '#D4537E' }}>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <SiKofi size={22} color="#fff" />
        </div>
        <div>
          <h3
            className="text-lg leading-none mb-0.5 text-white"
            style={{ fontFamily: "var(--font-fredoka), sans-serif", fontWeight: 600, letterSpacing: '0.02em' }}
          >
            KO-FI
          </h3>
          <p className="text-[11px] text-white opacity-85">One-time coffee · monthly memberships</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col justify-between gap-5 p-6 flex-1">
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ryu-text-2)' }}>
            The simplest way to say thanks. Buy a coffee, or become a monthly supporter
            to get early-access chapter previews and the occasional process post.
          </p>

          {/* Ko-fi logo centered */}
          <div className="flex justify-center py-4">
            <Image
              src="https://storage.ko-fi.com/cdn/cup-border.png"
              alt="Ko-fi"
              width={160}
              height={160}
              className="object-contain"
              unoptimized
            />
          </div>

          <p className="text-[11px] text-center" style={{ color: 'var(--ryu-text-3)' }}>
            Powered by Ko-fi · no fees, no cuts.
          </p>
        </div>

        {/* CTA */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{
            background:    '#D4537E',
            fontFamily:    "var(--font-fredoka), sans-serif",
            fontWeight:    600,
            letterSpacing: '0.02em',
            fontSize:      15,
            padding:       '12px 0',
          }}
        >
          <SiKofi size={16} color="#fff" />
          BUY RYU A COFFEE
        </a>
      </div>
    </div>
  )
}

function PatreonCard({ url }: { url: string }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ border: '0.5px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5" style={{ background: '#000000' }}>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <SiPatreon size={22} color="#fff" />
        </div>
        <div>
          <h3
            className="text-lg leading-none mb-0.5 text-white"
            style={{ fontFamily: "var(--font-fredoka), sans-serif", fontWeight: 600, letterSpacing: '0.02em' }}
          >
            PATREON
          </h3>
          <p className="text-[11px] text-white opacity-85">Monthly membership · pick a tier</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col justify-between gap-5 p-6 flex-1">
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ryu-text-2)' }}>
            Support Ryu every month and unlock the good stuff — early chapters,
            high-res art, and behind-the-scenes process posts.
          </p>

          {/* Patreon logo centered */}
          <div className="flex justify-center py-4">
            <div
              className="rounded-2xl flex items-center justify-center"
              style={{ width: 160, height: 160, background: '#fff', border: '0.5px solid var(--ryu-border)' }}
            >
              <SiPatreon size={80} color="#000" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{
            background:    '#000000',
            fontFamily:    "var(--font-fredoka), sans-serif",
            fontWeight:    600,
            letterSpacing: '0.02em',
            fontSize:      15,
            padding:       '12px 0',
          }}
        >
          <SiPatreon size={16} color="#fff" />
          BECOME A PATREON
        </a>
      </div>
    </div>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '0.5px solid var(--ryu-border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-3 text-left text-sm font-semibold"
        style={{ background: 'none', border: 'none', color: 'var(--ryu-text)', fontFamily: "var(--font-fredoka), sans-serif", cursor: 'pointer' }}
      >
        {q}
        <span style={{ color: open ? 'var(--ryu-primary)' : 'var(--ryu-text-muted)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>
          {open ? '×' : '+'}
        </span>
      </button>
      {open && (
        <p className="text-xs leading-relaxed pb-3" style={{ color: 'var(--ryu-text-secondary)', fontFamily: "var(--font-fredoka), sans-serif" }}>
          {a}
        </p>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function NoMethodsCard() {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl py-16 text-center col-span-2"
      style={{ border: '0.5px dashed var(--ryu-border)' }}
    >
      <img
        src="/pipilabu.png"
        alt="No donation methods yet"
        className="w-32 h-32 object-contain"
      />
      <p className="text-sm" style={{ color: 'var(--ryu-text-muted)' }}>
        Donation methods are being set up. Check back soon!
      </p>
      <Link href="/" className="text-xs underline" style={{ color: 'var(--ryu-primary)' }}>
        ← Go back home
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DonatePage() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((json: {settings: Settings}) => setSettings(json.settings))
      .catch(() => {})
  }, [])

  const kofiUrl    = settings?.kofi_url        ?? null
  const patreonUrl = settings?.patreon_url      ?? null
  const creator    = settings?.creator_name     ?? 'Ryu'
  const message    = settings?.donation_message ??
    "Ryuwanshoy is a one-person operation — written, drawn, lettered, and posted by someone with a day job and a deadline that keeps slipping. Everything's free, always. If the comics are worth a coffee to you, this is where you'd put it."

  const hasKofi    = Boolean(kofiUrl)
  const hasPatreon = Boolean(patreonUrl)
  const hasAny     = hasKofi || hasPatreon

  return (
    <main className="flex-1" style={{ background: 'var(--ryu-bg)' }}>

      {/* Hero */}
      <div style={{ borderBottom: '0.5px solid var(--ryu-border)', background: 'var(--ryu-surface-1)' }}>
        <div className="max-w-400 mx-auto px-12 py-10 text-center flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
            style={{ background: 'rgba(212,83,126,0.12)', color: '#D4537E' }}
          >
            <Heart size={32} />
          </div>
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-fredoka), sans-serif", fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ryu-text)' }}
          >
            SUPPORT {creator.toUpperCase()}
          </h1>
          <p
            className="text-sm leading-relaxed max-w-xl"
            style={{ color: 'var(--ryu-text-secondary)', fontFamily: "var(--font-fredoka), sans-serif" }}
          >
            {message}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-220 mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hasAny ? (
            <>
              {hasKofi    && <KofiCard    url={kofiUrl!}    />}
              {hasPatreon && <PatreonCard url={patreonUrl!} />}
            </>
          ) : (
            <NoMethodsCard />
          )}
        </div>
      </div>

      {/* FAQ */}
      <div
        className="max-w-180 mx-auto px-6 pb-16"
        style={{ borderTop: '0.5px solid var(--ryu-border)', paddingTop: 32 }}
      >
        <h2
          className="text-xl mb-4"
          style={{ fontFamily: "var(--font-fredoka), sans-serif", fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ryu-text)' }}
        >
          FAQ
        </h2>
        {FAQ_ITEMS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} />
        ))}
        <div className="mt-8 text-center flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--ryu-text-muted)', fontFamily: "var(--font-fredoka), sans-serif" }}>
            Can't chip in right now? Totally fine — reading the comic and sharing it with people is already a big help.
          </p>
          <div className="flex justify-center gap-4 text-xs">
            <Link href="/comics" className="font-semibold hover:underline underline-offset-2" style={{ color: 'var(--ryu-primary)' }}>
              Read the comics
            </Link>
          </div>
        </div>
      </div>

    </main>
  )
}