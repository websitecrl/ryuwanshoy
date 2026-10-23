import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { serverError } from '@/lib/api-errors'
import { requireAdmin } from '@/lib/require-admin'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('likes')
    .delete()
    .eq('id', id)

  if (error) return serverError('DELETE /api/likes/[id]', error, 'Failed to delete like.')
  return NextResponse.json({ success: true })
}