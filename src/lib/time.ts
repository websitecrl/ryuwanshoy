export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  // Supabase timestamps are UTC — append Z if missing so JS parses correctly
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z'
  const diff  = Date.now() - new Date(normalized).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}