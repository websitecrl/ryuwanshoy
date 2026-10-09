// ─── Comment ownership (edit_token) storage ──────────────────────────────────
// POST /api/comments issues a one-time edit_token, which we keep in
// localStorage so this browser (and only this browser) can later
// PATCH/DELETE that specific comment. There are no reader accounts, so this
// token is the only proof of ownership.
//
// Never rename this key: readers would lose control of comments they
// already posted.
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
    // Not worth surfacing: worst case, edit/delete just won't persist
    // across a reload for this comment.
  }
}

/** @returns the edit_token for this comment, or null when this browser didn't post it */
export function getToken(commentId: string): string | null {
  return getTokenMap()[commentId] ?? null
}
