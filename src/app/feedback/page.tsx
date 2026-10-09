import type { Metadata } from 'next'
import FeedbackForm from './FeedbackForm'

export const metadata: Metadata = {
  title: 'Feedback | Ryuwanshoy',
  description: 'Report a bug, share an idea, or tell us anything about the site.',
  // A form page: nothing for search engines to index.
  robots: { index: false },
}

// Static page: no data, so it's served straight from the cache. The form
// posts to /api/feedback; the page the reader came from (?from=) is read in
// the browser at submit time, so it doesn't make this page dynamic.
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
