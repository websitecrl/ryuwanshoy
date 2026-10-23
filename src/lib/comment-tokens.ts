// edit_token per comment in this browser = proof of ownership. never rename the key
const TOKEN_STORE = 'ryu.comment.tokens'

/** comment id -> edit_token */
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

/** null -> not posted from this browser */
export function getToken(commentId: string): string | null {
  return getTokenMap()[commentId] ?? null
}
