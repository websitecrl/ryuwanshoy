import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** unread total (all rows) -> returned after every admin action. throws on DB error */
export async function countUnreadFeedback(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}
