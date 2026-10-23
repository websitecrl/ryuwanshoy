import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/admin/Sidebar'


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
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  // logged in -> admin shell
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
