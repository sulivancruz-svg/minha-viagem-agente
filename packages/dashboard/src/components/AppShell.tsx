'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { AuthGuard } from '@/components/AuthGuard'

const NO_SHELL_PATHS = ['/login']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = NO_SHELL_PATHS.some(p => pathname.startsWith(p))

  if (isPublic) {
    return <>{children}</>
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
