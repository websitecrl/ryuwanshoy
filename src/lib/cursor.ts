/**
 * "Load older" pagination cursors: the created_at of the last row already
 * shown, as PostgREST returns a `timestamp without time zone` column
 * (e.g. 2026-10-08T12:34:56.123456). The next page is `created_at < cursor`.
 *
 * Validated before it reaches a query, so a cursor is always a plain
 * timestamp and never arbitrary filter text.
 */
const CURSOR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/

/** True when `value` is a well-formed cursor. */
export function isCursor(value: string): boolean {
  return CURSOR_RE.test(value)
}

/**
 * Reads the ?limit= parameter.
 * @returns `fallback` when missing or invalid, otherwise capped at `max`
 */
export function readLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}
