import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEASignedUrl} from '@/lib/r2'
import { checkEarlyAccessEntitlement } from '@/lib/ea-entitlement'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request)
    const allowed = await checkRateLimit(`ea-page:${ip}`, 60, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id } = await params

    const { data: page, error } = await supabaseAdmin
      .from('pages')
      .select(`
        id, image_url,
        chapter:chapter_id (
          is_published, is_early_access,
          series:series_id ( is_published )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const chapter = page.chapter as {
      is_published: boolean | null
      is_early_access: boolean | null
      series: { is_published: boolean | null } | null
    } | null

    if (!chapter?.is_published || !chapter.series?.is_published) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    if (!chapter.is_early_access) {
      return NextResponse.json(
        { error: 'This page is not gated — use its public URL directly' },
        { status: 400 }
      )
    }

    if (!page.image_url.startsWith('ea:')) {
      console.error(`EA chapter page ${id} has a non-EA image_url:`, page.image_url)
      return NextResponse.json({ error: 'Page is misconfigured' }, { status: 500 })
    }

    const entitled = await checkEarlyAccessEntitlement(request)
    if (!entitled) {
      return NextResponse.json({ error: 'Early access required' }, { status: 403 })
    }

    const signedUrl = await getEASignedUrl(page.image_url)
    return NextResponse.redirect(signedUrl)
  } catch (err) {
    console.error('GET /api/reader/ea-page/[id] error:', err)
    return NextResponse.json({ error: 'Failed to load page' }, { status: 500 })
  }
}