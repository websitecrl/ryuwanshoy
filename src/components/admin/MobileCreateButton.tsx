import Link from 'next/link'
import { Plus } from 'lucide-react'

/**
 * Phones only (under 768px): the page's main "New ..." action as a round
 * button in the bottom right corner, where the thumb already rests. From
 * 768px the page's own header button is used instead (it hides itself under
 * 768px with max-md:hidden).
 *
 * @param href - where the header button goes
 * @param label - read by screen readers and shown as a tooltip, e.g. "New series"
 *
 * The page needs extra bottom padding on phones (max-md:pb-24) so this
 * button never sits on top of the last item's own buttons.
 */
export default function MobileCreateButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="md:hidden fixed z-30 flex items-center justify-center w-14 h-14 rounded-full active:scale-95 transition-transform"
      style={{
        right: 'calc(16px + env(safe-area-inset-right))',
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        background: 'var(--ryu-primary)',
        color: 'var(--ryu-on-primary)',
        border: '1px solid var(--ryu-primary-deep)',
        boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--ryu-shadow) 55%, transparent)',
      }}
    >
      <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
    </Link>
  )
}
