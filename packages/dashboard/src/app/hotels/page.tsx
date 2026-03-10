'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Hotel {
  id: string
  name: string
  destination: string
  stars?: number
  priceFrom?: number
  highlights: string[]
  images: string[]
  isActive: boolean
  createdAt: string
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getHotels()
      .then(data => setHotels(data as Hotel[]))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Catálogo de Hotéis</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie hotéis e ofertas para vendas</p>
        </div>
        <Link href="/hotels/new" className="btn-primary">
          + Novo hotel
        </Link>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200 text-red-700 mb-6">
          <div className="font-semibold">Erro ao carregar hotéis</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : hotels.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🏨</div>
          <div className="font-semibold">Nenhum hotel cadastrado ainda.</div>
          <Link href="/hotels/new" className="inline-block mt-4 btn-primary">
            Cadastrar primeiro hotel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotels.map(h => (
            <Link
              key={h.id}
              href={`/hotels/${h.id}`}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              {/* Thumbnail da primeira imagem */}
              {h.images && h.images.length > 0 && (
                <div className="mb-3 w-full h-40 bg-gray-100 rounded overflow-hidden">
                  <img
                    src={h.images[0]}
                    alt={h.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}

              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{h.name}</div>
                    <div className="text-sm text-gray-600">{h.destination}</div>
                  </div>
                  {h.stars && (
                    <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded whitespace-nowrap">
                      ⭐ {h.stars}
                    </div>
                  )}
                </div>

                {h.priceFrom && (
                  <div className="mt-2 text-sm font-semibold text-green-600">
                    A partir de R$ {h.priceFrom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                )}

                {h.highlights && h.highlights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {h.highlights.slice(0, 3).map((highlight, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                      >
                        {highlight}
                      </span>
                    ))}
                    {h.highlights.length > 3 && (
                      <span className="text-xs text-gray-500">+{h.highlights.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className={`text-xs font-semibold ${h.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {h.isActive ? '✓ Ativo' : 'Inativo'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
