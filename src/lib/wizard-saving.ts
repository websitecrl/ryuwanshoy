// Tiny shared flag: true while the series wizard is publishing. Rows created
// during Publish stay unpublished until the very end, so the sidebar would
// count them as drafts for a moment; it reads this flag to skip that.

let saving = false
const listeners = new Set<(saving: boolean) => void>()

export function setWizardSaving(value: boolean) {
  if (saving === value) return
  saving = value
  listeners.forEach(listener => listener(value))
}

export function isWizardSaving() {
  return saving
}

/** @returns an unsubscribe function */
export function subscribeWizardSaving(listener: (saving: boolean) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
