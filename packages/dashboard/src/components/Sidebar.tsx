'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/', label: 'Visao Geral', emoji: '📊' },
  { href: '/hotels', label: 'Hoteis', emoji: '🏨' },
  { href: '/campaigns', label: 'Campanhas', emoji: '📢' },
  { href: '/contacts', label: 'Contatos', emoji: '👥' },
  { href: '/metrics', label: 'Metricas', emoji: '📈' },
]

const ADMIN_NAV = [
  { href: '/admin/users', label: 'Usuarios', emoji: '👤' },
]

export function Sidebar() {
  const path = usePathname()
  const [role, setRole] = useState('AGENT')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mv_user')
      if (!raw) return
      const parsed = JSON.parse(raw) as { role?: string }
      if (parsed.role) setRole(parsed.role)
    } catch {
      setRole('AGENT')
    }
  }, [])

  const canSeeAdmin = role === 'SUPER_ADMIN'

  return (
    <aside className="w-56 h-screen bg-[#075e54] text-white flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-white/10">
        <div className="font-extrabold text-lg tracking-tight">Minha Viagem</div>
        <div className="text-xs text-white/60 mt-0.5">Agente de Vendas</div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/40">
          Painel do Agente
        </div>
        {NAV.map(item => {
          const active = path === item.href || (item.href !== '/' && path.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}

        {canSeeAdmin && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/40">
              Admin SaaS
            </div>
            {ADMIN_NAV.map(item => {
              const active = path.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-base">{item.emoji}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => {
            localStorage.removeItem('mv_token')
            localStorage.removeItem('mv_user')
            localStorage.removeItem('mv_api_token')
            window.location.href = '/login'
          }}
          className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          🚪 Sair
        </button>
        <div className="text-xs text-white/30 mt-2">v1.0.0 - SaaS</div>
      </div>
    </aside>
  )
}
