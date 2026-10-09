// Ends in Z, or in a +hh:mm / -hhmm offset: the string already says its zone.
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

/**
 * "just now" / "5m ago" / "3h ago" / "2d ago".
 * @param dateStr - a Supabase timestamp. `timestamp without time zone`
 *   columns come back without a zone but are UTC, so "Z" is appended; a
 *   `timestamptz` value (e.g. feedback.created_at, "...+00:00") already has
 *   one and must be parsed as is (appending Z would make it Invalid Date).
 */
export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const normalized = HAS_ZONE.test(dateStr) ? dateStr : dateStr + 'Z'
  const diff  = Date.now() - new Date(normalized).getTime()
  if (Number.isNaN(diff)) return ''
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
