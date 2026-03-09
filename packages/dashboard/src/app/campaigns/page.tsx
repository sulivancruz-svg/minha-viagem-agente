'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Campaign {
  id:          string
  name:        string
  destination: string
  dateRange:   string
  priceFrom:   number | null
  isActive:    boolean
  createdAt:   string
  _count:      { sends: number }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    api.getCampaigns()
      .then(data => setCampaigns(data as Campaign[]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie e dispare campanhas de viagem</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          + Nova campanha
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📢</div>
          <div className="font-semibold">Nenhuma campanha criada ainda.</div>
          <Link href="/campaigns/new" className="inline-block mt-4 btn-primary">
            Criar primeira campanha
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <div className="font-bold text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-500">
                    {c.destination} | {c.dateRange}
                    {c.priceFrom && ` | A partir de R$ ${Number(c.priceFrom).toLocaleString('pt-BR')}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-center">
                  <div className="font-bold text-gray-900">{c._count.sends}</div>
                  <div className="text-xs text-gray-400">envios</div>
                </div>
                <Link href={`/campaigns/${c.id}`} className="btn-secondary text-xs">
                  Ver detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
