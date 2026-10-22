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

/** Throws on failure, so a cached page keeps its last good copy. One lookup per request. */
export const getSettingsOrThrow = cache(() => querySettings())

/** Null on failure. Only for the root layout, where a throw would take down every page. */
export const getSettings = cache(async () => {
  try {
    return await getSettingsOrThrow()
  } catch (err) {
    console.error('getSettings failed:', err)
    return null
  }
})
