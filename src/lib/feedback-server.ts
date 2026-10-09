import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Total unread feedback reports (all rows, not one page).
 * Returned after every admin action so the inbox shows the server's number
 * and can't drift from the database or the notification bell.
 * @throws on a database error (callers turn it into a 500)
 */
export async function countUnreadFeedback(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}
