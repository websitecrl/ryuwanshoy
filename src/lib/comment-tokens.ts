// A comment's edit_token, kept in this browser as the only proof of ownership (no reader accounts).
// Never rename the key: readers would lose control of comments they posted.
const TOKEN_STORE = 'ryu.comment.tokens'

/** @returns every comment id → edit_token this browser holds */
export function getTokenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_STORE)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch { return {} }
}

export function saveToken(commentId: string, token: string) {
  try {
    const map = getTokenMap()
    map[commentId] = token
    localStorage.setItem(TOKEN_STORE, JSON.stringify(map))
  } catch {
  }
}

/** @returns the edit_token for this comment, or null when this browser didn't post it */
export function getToken(commentId: string): string | null {
  return getTokenMap()[commentId] ?? null
}
