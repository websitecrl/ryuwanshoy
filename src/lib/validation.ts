// Any 8-4-4-4-12 hex string, the same shape Postgres accepts for a uuid
// column. Deliberately looser than uuid's validate(), which also checks the
// version and variant bits: Postgres doesn't, so neither do we.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * True when `value` is a string Postgres will accept as a uuid.
 *
 * Check ids from the request with this before querying, so a malformed id
 * becomes a clean 400/404 instead of a Postgres "invalid input syntax for
 * type uuid" 500. Also used to tell an id from a slug.
 *
 * @param value - anything from the request (query param, body field, path)
 * @returns true only for a uuid-shaped string; narrows the type to string
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
