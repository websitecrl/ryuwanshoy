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
  /** Throw on failure: the dialog stays open and shows the message. */
  onConfirm: () => Promise<void>
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel?: string
  successMessage?: string
  /** 'icon' (lists), 'text' (edit pages) or 'pill' (bulk actions). */
  variant?: Variant
  /** Visible text for 'text'/'pill'; accessible name (and tooltip) for 'icon'. */
  label?: string
  size?: number
  disabled?: boolean
  confirmDisabled?: boolean
  onOpenChange?: (open: boolean) => void
}

/** The one admin delete control: confirm dialog, spinner while deleting, error keeps the dialog open. */
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
