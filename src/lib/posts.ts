// Shared by the /posts page, its "Load more" client and GET /api/posts, so
// the page size, filters and fields can't drift apart.

export const POST_TYPES = ['sketch', 'drawing', 'meme', 'other']

/** Posts per load on /posts: divides evenly into the 2/3/4 column grid. */
export const POSTS_PAGE_SIZE = 24

/** Fields the public grid and PostModal need. */
export const POST_LIST_FIELDS = 'id, title, description, image_url, post_type, created_at'

/** A known post type, or null for "all" (unknown values are ignored). */
export function normalizePostType(type: string | null | undefined): string | null {
  return type && POST_TYPES.includes(type) ? type : null
}
