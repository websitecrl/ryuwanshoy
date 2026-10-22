// Any 8-4-4-4-12 hex string, the same shape Postgres accepts (no version/variant check).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a uuid-shaped string. Check request ids with it so a bad id is a 400/404, not a Postgres 500. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
