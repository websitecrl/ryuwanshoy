// "Load older" cursor: created_at of the last shown row. Validated so it's never arbitrary filter text.
const CURSOR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/

export function isCursor(value: string): boolean {
  return CURSOR_RE.test(value)
}

/** ?limit= as a number: fallback when missing or invalid, capped at max. */
export function readLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}
