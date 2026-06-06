import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { error } = await supabaseAdmin
    .from('comments')
    .update({ is_read: true })
    .eq('is_read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}