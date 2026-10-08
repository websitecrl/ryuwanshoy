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

/**
 * Site settings; THROWS on failure. Use it on cached (ISR) pages: a thrown
 * error makes Next keep serving the last good copy of the page, instead of
 * caching a page with no logo or title for everyone.
 * cache() makes it one lookup per request no matter how many callers.
 */
export const getSettingsOrThrow = cache(() => querySettings())

/**
 * Site settings, or null on failure. Only for the root layout: a throw there
 * would take down every page (there is no global-error.tsx), so it falls back
 * to defaults. Shares the same per-request lookup as getSettingsOrThrow.
 * Caveat: a page whose only settings read is this one (e.g. /donate) can
 * cache the fallback for up to 60 s.
 */
export const getSettings = cache(async () => {
  try {
    return await getSettingsOrThrow()
  } catch (err) {
    console.error('getSettings failed:', err)
    return null
  }
})
