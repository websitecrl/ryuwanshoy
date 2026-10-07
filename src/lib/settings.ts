import 'server-only'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { cachedPublicQuery } from '@/lib/cache/public-cache'

const querySettings = cachedPublicQuery('settings', async () => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('settings')
    .select('site_title, creator_name, site_description, logo_url, facebook_url, instagram_url, twitter_url, tiktok_url, youtube_url')
    .single()

  if (error) throw error
  return data
})

// Shared by the root layout and the home page (metadata + render).
// cache() makes it one lookup per request no matter how many callers; the
// query itself is cached across requests by cachedPublicQuery.
// Returns null on failure so the layout falls back to defaults instead of
// taking the whole site down; the failure is never cached.
export const getSettings = cache(async () => {
  try {
    return await querySettings()
  } catch (err) {
    console.error('getSettings failed:', err)
    return null
  }
})
