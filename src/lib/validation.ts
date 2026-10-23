// 8-4-4-4-12 hex (what Postgres accepts)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** uuid-shaped? -> bad ids become 400/404, not a Postgres 500 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
