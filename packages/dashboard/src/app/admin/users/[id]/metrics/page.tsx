'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Metrics {
  totalSends: number
  totalReplied: number
  replyRate: number
  totalTasks: number
  completedTasks: number
  activeContacts: number
  sendsByDay: Record<string, { sent: number; replied: number }>
  recentSends: Array<{
    id: string
    status: string
    sentAt: string
    repliedAt?: string
    contact: { name: string; phoneE164: string }
    campaign: { name: string }
  }>
}

export default function UserMetricsPage() {
  const { id } = useParams<{ id: string }>()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.adminUserMetrics(id, days),
      api.adminGetUser(id),
    ]).then(([m, u]) => {
      setMetrics(m as Metrics)
      setUser(u as any)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, days])

  if (loading) return <div className="p-8 text-gray-400">Carregando metricas...</div>
  if (!metrics || !user) return <div className="p-8 text-red-500">Erro ao carregar</div>

  const dayEntries = Object.entries(metrics.sendsByDay).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-600">&larr; Voltar</Link>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="input w-auto">
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPI label="Disparos" value={metrics.totalSends} />
        <KPI label="Respostas" value={metrics.totalReplied} />
        <KPI label="Taxa" value={`${metrics.replyRate}%`} color={metrics.replyRate >= 30 ? 'text-green-600' : metrics.replyRate >= 15 ? 'text-yellow-600' : 'text-red-600'} />
        <KPI label="Tarefas" value={metrics.totalTasks} />
        <KPI label="Concluidas" value={metrics.completedTasks} />
        <KPI label="Contatos" value={metrics.activeContacts} />
      </div>

      {/* Timeline */}
      {dayEntries.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Envios por dia</h2>
          <div className="flex items-end gap-1 h-32">
            {dayEntries.map(([day, data]) => {
              const max = Math.max(...dayEntries.map(([, d]) => d.sent), 1)
              const h = (data.sent / max) * 100
              const rh = (data.replied / max) * 100
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-0.5" title={`${day}: ${data.sent} enviados, ${data.replied} respondidos`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                    <div className="bg-brand-900/20 rounded-t" style={{ height: `${h}%`, minHeight: data.sent > 0 ? 4 : 0 }}>
                      <div className="bg-green-500 rounded-t" style={{ height: `${rh > 0 ? (rh / h) * 100 : 0}%`, minHeight: data.replied > 0 ? 4 : 0 }} />
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400">{day.slice(5)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-900/20 rounded" /> Enviados</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> Respondidos</span>
          </div>
        </div>
      )}

      {/* Ultimos envios */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">Ultimos envios</h2>
        </div>
        {metrics.recentSends.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum envio no periodo</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Campanha</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Enviado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metrics.recentSends.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{s.contact.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.campaign.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.status === 'REPLIED' ? 'bg-green-100 text-green-700' :
                      s.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {s.status === 'REPLIED' ? 'Respondido' : s.status === 'SENT' ? 'Enviado' : s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(s.sentAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1 uppercase font-semibold">{label}</div>
    </div>
  )
}
