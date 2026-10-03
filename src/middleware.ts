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

  // Only the account matching ADMIN_USER_ID is admin. Both sides must be set:
  // if the env var is missing, nobody is admin (same as require-admin.ts).
  const adminId = process.env.ADMIN_USER_ID
  if (!adminId) {
    console.error('[middleware] ADMIN_USER_ID is not set; denying all admin access')
  }
  const isAdmin = !!user && !!adminId && user.id === adminId

  // Carry any cookies Supabase set or cleared (token refresh, sign out)
  // onto responses we build ourselves, or they'd be dropped.
  function withCookies<T extends NextResponse>(res: T): T {
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/admin'
  const isResetPage = pathname.startsWith('/admin/reset-password')
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi =
    (pathname.startsWith('/api/early-access') && request.method !== 'POST') ||
    (pathname.startsWith('/api/settings') && request.method === 'PATCH')

  // Protect admin API routes (the routes also call requireAdmin())
  if (isAdminApi && !isAdmin) {
    return withCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  // Password reset must stay reachable signed in or out: the recovery link
  // signs the user in, and updateUser() on that page needs the session.
  if (isResetPage) return response

  // Login page: always reachable. Only the admin skips ahead to the dashboard,
  // so a non-admin session can't bounce between /admin and /admin/dashboard.
  if (isLoginPage) {
    if (isAdmin) {
      return withCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)))
    }
    return response
  }

  // Every other admin page: admin only. A signed-in non-admin is signed out
  // (this browser only) so the login page's client-side push to /admin/dashboard
  // can't loop them back here.
  if (isAdminPage && !isAdmin) {
    if (user) await supabase.auth.signOut({ scope: 'local' })
    return withCookies(NextResponse.redirect(new URL('/admin', request.url)))
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