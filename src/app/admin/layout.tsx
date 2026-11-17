import type { Viewport } from 'next'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/admin/Sidebar'

// cover -> env(safe-area-inset-*) reports real values on iPhone, so the sticky
// action bars can clear the home indicator. Admin routes only: the reader side
// keeps the default viewport.
export const viewport: Viewport = { viewportFit: 'cover' }

// admin-root scopes the phone rules in globals.css ("Admin on phones")

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // no user -> login only
  if (!user) {
    return (
      <div className="admin-root min-h-dvh bg-background">
        {children}
      </div>
    )
  }

  // logged in -> admin shell. under 768px: top bar above the page, sidebar as a drawer
  return (
    <div className="admin-root flex max-md:flex-col min-h-dvh bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
