'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// recharts precisa de dynamic import para evitar crash de SSR
const BarChart = dynamic<any>(() => import('recharts').then(m => m.BarChart as any), { ssr: false })
const Bar = dynamic<any>(() => import('recharts').then(m => m.Bar as any), { ssr: false })
const XAxis = dynamic<any>(() => import('recharts').then(m => m.XAxis as any), { ssr: false })
const YAxis = dynamic<any>(() => import('recharts').then(m => m.YAxis as any), { ssr: false })
const Tooltip = dynamic<any>(() => import('recharts').then(m => m.Tooltip as any), { ssr: false })
const ResponsiveContainer = dynamic<any>(() => import('recharts').then(m => m.ResponsiveContainer as any), { ssr: false })

interface Funnel { funnel: Record<string, number>; total: number; conversion: number }
type TimelineEntry = { date: string; sent: number }

const FUNNEL_ORDER = ['NEW','CONTACTED','QUOTE_REQUESTED','PROPOSAL_SENT','CLOSED_WON','CLOSED_LOST','OPTED_OUT']
const FUNNEL_LABELS: Record<string, string> = {
  NEW: 'Novo Lead', CONTACTED: 'Contatado', QUOTE_REQUESTED: 'Pediu Cotação',
  PROPOSAL_SENT: 'Proposta Enviada', CLOSED_WON: 'Fechado ✓', CLOSED_LOST: 'Perdido', OPTED_OUT: 'Opt-out',
}
const FUNNEL_COLORS: Record<string, string> = {
  NEW: '#3b82f6', CONTACTED: '#8b5cf6', QUOTE_REQUESTED: '#f59e0b',
  PROPOSAL_SENT: '#06b6d4', CLOSED_WON: '#22c55e', CLOSED_LOST: '#ef4444', OPTED_OUT: '#9ca3af',
}

export default function MetricsPage() {
  const [funnel,   setFunnel]   = useState<Funnel | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([api.getFunnel(), api.getTimeline(14)])
      .then(([f, t]) => {
        setFunnel(f)
        setTimeline(t as TimelineEntry[])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Métricas</h1>
        <p className="text-sm text-gray-500 mt-1">Funil de vendas e histórico de envios assistidos</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* KPIs do funil */}
          {funnel && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total de leads',    value: funnel.total,                                    color: 'text-blue-600' },
                { label: 'Fechados',          value: funnel.funnel['CLOSED_WON'] ?? 0,               color: 'text-green-600' },
                { label: 'Taxa de conversão', value: `${funnel.conversion ?? 0}%`,                   color: 'text-yellow-600' },
                { label: 'Opt-out',           value: funnel.funnel['OPTED_OUT'] ?? 0,                color: 'text-red-500' },
              ].map(kpi => (
                <div key={kpi.label} className="card p-4">
                  <div className={`text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Funil de vendas */}
          {funnel && (
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">Funil de Vendas</h2>
              <div className="space-y-2">
                {FUNNEL_ORDER.map(stage => {
                  const count = funnel.funnel[stage] ?? 0
                  const pct   = funnel.total > 0 ? (count / funnel.total) * 100 : 0
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <div className="w-40 text-xs text-gray-600 text-right shrink-0">
                        {FUNNEL_LABELS[stage]}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%`, background: FUNNEL_COLORS[stage] }}
                        />
                      </div>
                      <div className="w-10 text-xs font-bold text-gray-700 text-right">{count}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Timeline de envios assistidos */}
          {timeline.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">Envios assistidos por dia (últimos 14 dias)</h2>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="sent" name="Enviados" fill="#075e54" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
