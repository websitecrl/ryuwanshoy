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

// Support page (/donate). Its own query: the layout's settings don't include these fields.
const queryDonationSettings = cachedPublicQuery('settings:donation', async () => {
  const { data, error } = await createPublicClient()
    .from('settings')
    .select('kofi_url, patreon_url, creator_name, donation_message')
    .maybeSingle()

  if (error) throw error
  return data
})

export type DonationSettings = NonNullable<Awaited<ReturnType<typeof queryDonationSettings>>>

/** donation fields; null when there is no settings row. throws on a DB error (cached page keeps its last good copy) */
export const getDonationSettingsOrThrow = cache(() => queryDonationSettings())

/** throw -> cached page keeps its last good copy */
export const getSettingsOrThrow = cache(() => querySettings())

/** null on failure -> root layout only */
export const getSettings = cache(async () => {
  try {
    return await getSettingsOrThrow()
  } catch (err) {
    console.error('getSettings failed:', err)
    return null
  }
})
