// wizard publishing -> sidebar skips the draft count

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
