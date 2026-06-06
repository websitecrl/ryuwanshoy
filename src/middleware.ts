import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/admin'
  const isResetPage = pathname.startsWith('/admin/reset-password')
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi =
    (pathname.startsWith('/api/early-access') && request.method !== 'POST') ||
    (pathname.startsWith('/api/settings') && request.method === 'PATCH')

  // Protect admin API routes
  if (isAdminApi && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Protect admin pages — redirect to login if not authenticated
  if (isAdminPage && !isLoginPage && !isResetPage && !user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // If already logged in and on login page — go to dashboard
  if (isLoginPage && user) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/early-access',
    '/api/early-access/:path*',
    '/api/settings',
  ],
}