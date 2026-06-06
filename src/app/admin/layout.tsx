import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/admin/Sidebar'


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No user — render login page only, no sidebar
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  // Logged in — full admin shell with sidebar
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
