import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  return NextResponse.json({ count: count ?? 0 })
}
