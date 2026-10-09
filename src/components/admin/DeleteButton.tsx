'use client'

import { useState, type ReactNode } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Variant = 'icon' | 'text' | 'pill'

type Props = {
  /** Does the delete. Throw (e.g. `throw new Error(json.error)`) on failure:
   *  the dialog then stays open and shows the message. */
  onConfirm: () => Promise<void>
  /** Dialog title, e.g. `Delete "My Series"?` */
  title: string
  /** Dialog body. Defaults to "This permanently deletes it. This cannot be undone." */
  description?: ReactNode
  /** Extra dialog content under the description (e.g. a list of what goes). */
  children?: ReactNode
  /** Red button text. Default "Delete". */
  confirmLabel?: string
  /** Toast shown after a successful delete. Omit for no toast. */
  successMessage?: string
  /** 'icon': square trash button (lists). 'text': red text link (edit pages).
   *  'pill': red pill with icon + label (bulk actions). Default 'icon'. */
  variant?: Variant
  /** Visible text for 'text'/'pill'; accessible name (and tooltip) for 'icon'. */
  label?: string
  /** Square size in px for 'icon'. Default 32. */
  size?: number
  disabled?: boolean
  /** Disables only the red confirm button (e.g. until a preview has loaded). */
  confirmDisabled?: boolean
  /** Called when the dialog opens/closes (e.g. to load a preview on open). */
  onOpenChange?: (open: boolean) => void
}

/**
 * The one delete control for the admin: a trigger that opens a confirm
 * dialog (Cancel / red Delete). Every delete looks and behaves the same:
 * - spinner + disabled buttons while deleting,
 * - success closes the dialog (and toasts if `successMessage` is set),
 * - failure keeps the dialog open with the error, so it can't go unnoticed.
 *
 * Colors only from tokens (--ryu-danger / --ryu-on-danger in globals.css).
 * The trigger is the dialog's own element, never a <button> nested in it
 * (nested buttons cause a hydration error; this project doesn't use asChild).
 */
export default function DeleteButton({
  onConfirm,
  title,
  description = 'This permanently deletes it. This cannot be undone.',
  children,
  confirmLabel = 'Delete',
  successMessage,
  variant = 'icon',
  label = 'Delete',
  size = 32,
  disabled = false,
  confirmDisabled = false,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function changeOpen(next: boolean) {
    if (deleting) return // don't close mid-delete
    setOpen(next)
    if (next) setError(null)
    onOpenChange?.(next)
  }

  async function confirm() {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
      if (successMessage) toast.success(successMessage)
      setOpen(false)
      onOpenChange?.(false)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Delete failed. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const triggerBase =
    'transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-[var(--ryu-danger)]'

  const trigger =
    variant === 'icon' ? (
      <AlertDialogTrigger
        disabled={disabled || deleting}
        aria-label={label}
        title={label}
        className={`${triggerBase} shrink-0 rounded-lg flex items-center justify-center border
                    border-[var(--ryu-border-soft)] bg-[var(--ryu-surface-1)] text-[var(--ryu-text-3)]
                    hover:border-[var(--ryu-danger)] hover:text-[var(--ryu-danger)]
                    hover:bg-[color-mix(in_srgb,var(--ryu-danger)_8%,transparent)]`}
        style={{ width: size, height: size }}
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </AlertDialogTrigger>
    ) : variant === 'text' ? (
      <AlertDialogTrigger
        disabled={disabled || deleting}
        className={`${triggerBase} text-sm font-semibold text-[var(--ryu-danger)] hover:underline`}
      >
        {label}
      </AlertDialogTrigger>
    ) : (
      <AlertDialogTrigger
        disabled={disabled || deleting}
        className={`${triggerBase} inline-flex items-center gap-1.5 rounded-full px-4 h-9 text-sm font-semibold
                    text-[var(--ryu-danger)] bg-[color-mix(in_srgb,var(--ryu-danger)_12%,transparent)]
                    hover:bg-[color-mix(in_srgb,var(--ryu-danger)_20%,transparent)]`}
      >
        <Trash2 size={14} /> {label}
      </AlertDialogTrigger>
    )

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      {trigger}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error && (
          <p role="alert" className="text-sm text-[var(--ryu-danger)]">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void confirm()}
            disabled={deleting || confirmDisabled}
            className="bg-[var(--ryu-danger)] text-[var(--ryu-on-danger)] hover:opacity-90"
          >
            {deleting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
