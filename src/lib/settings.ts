import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Shared by the root layout and the home page (metadata + render).
// cache() makes it one query per request no matter how many callers.
export const getSettings = cache(async () => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('settings')
      .select('site_title, creator_name, site_description, logo_url, facebook_url, instagram_url, twitter_url, tiktok_url, youtube_url')
      .single()

    if (error) throw error
    return data
  } catch {
    return null
  }
})
