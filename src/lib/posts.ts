// shared by /posts, "Load more" and GET /api/posts

export const POST_TYPES = ['sketch', 'drawing', 'meme', 'other']

/** fits the 2/3/4 column grid */
export const POSTS_PAGE_SIZE = 24

/** Fields the public grid and PostModal need. */
export const POST_LIST_FIELDS = 'id, title, description, image_url, post_type, created_at'

/** known type, else null (all) */
export function normalizePostType(type: string | null | undefined): string | null {
  return type && POST_TYPES.includes(type) ? type : null
}
