'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Overview {
  totalContacts:   number
  confirmedOptIn:  number
  activeCampaigns: number
  sendsToday:      number
  sendsWeek:       number
  openTasks:       number
}

const STAT_CARDS = [
  { key: 'totalContacts',   label: 'Total de Contatos',  emoji: '👥', color: 'bg-blue-50  text-blue-700'  },
  { key: 'confirmedOptIn',  label: 'Com Opt-in',         emoji: '✅', color: 'bg-green-50 text-green-700' },
  { key: 'activeCampaigns', label: 'Campanhas Ativas',   emoji: '📢', color: 'bg-yellow-50 text-yellow-700' },
  { key: 'sendsToday',      label: 'Envios Hoje',        emoji: '📨', color: 'bg-purple-50 text-purple-700' },
  { key: 'sendsWeek',       label: 'Envios na Semana',   emoji: '📊', color: 'bg-orange-50 text-orange-700' },
  { key: 'openTasks',       label: 'Tarefas Abertas',    emoji: '🗒️', color: 'bg-red-50    text-red-700'   },
]

export default function OverviewPage() {
  const [data,    setData]    = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Visao Geral</h1>
        <p className="text-sm text-gray-500 mt-1">Dashboard de acompanhamento de leads e campanhas</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error.includes('401') || error.includes('403')
            ? 'Acesso negado. Configure o token no popup da extensao.'
            : `Erro ao carregar dados: ${error}`}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse h-28 bg-gray-100" />
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {STAT_CARDS.map(card => (
            <div key={card.key} className="card p-6">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl ${card.color} mb-3`}>
                {card.emoji}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 leading-none mb-1">
                {(data[card.key as keyof Overview] ?? 0).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Links rapidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/campaigns/new', label: 'Nova Campanha',    emoji: '➕', desc: 'Crie uma campanha de viagem' },
          { href: '/contacts',      label: 'Importar Contatos', emoji: '📥', desc: 'Importe uma lista CSV' },
          { href: '/metrics',       label: 'Ver Metricas',     emoji: '📈', desc: 'Funil de vendas e taxas' },
        ].map(item => (
          <a
            key={item.href}
            href={item.href}
            className="card p-5 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="text-2xl mb-2">{item.emoji}</div>
            <div className="font-bold text-gray-900 group-hover:text-brand-900">{item.label}</div>
            <div className="text-sm text-gray-500 mt-0.5">{item.desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
