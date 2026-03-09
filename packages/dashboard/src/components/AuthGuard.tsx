'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Paginas que NAO precisam de autenticacao
const PUBLIC_PATHS = ['/login']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
    if (isPublic) {
      setChecked(true)
      return
    }

    const token = localStorage.getItem('mv_token')
    if (!token) {
      window.location.href = '/login'
      return
    }
    setChecked(true)
  }, [pathname])

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <>{children}</>
}
