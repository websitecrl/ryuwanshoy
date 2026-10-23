import type { Metadata } from 'next'
import FeedbackForm from './FeedbackForm'

export const metadata: Metadata = {
  title: 'Feedback | Ryuwanshoy',
  description: 'Report a bug, share an idea, or tell us anything about the site.',
  // form page -> not indexed
  robots: { index: false },
}

// static -> cached; ?from= read in the browser at submit
export default function FeedbackPage() {
  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-1">
          <h1
            className="text-3xl leading-none text-[var(--ryu-text)]"
            style={{ fontFamily: 'var(--font-fredoka), sans-serif', fontWeight: 600, letterSpacing: '0.02em' }}
          >
            Feedback
          </h1>
          <p className="text-sm text-[var(--ryu-text-2)]">
            Found a bug or have an idea? Tell us here. Every message is read.
          </p>
        </header>
        <FeedbackForm />
      </div>
    </main>
  )
}
