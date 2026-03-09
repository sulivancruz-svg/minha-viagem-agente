'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Hotel {
  id: string
  name: string
  destination: string
  stars?: number
  description?: string
  highlights: string[]
  priceFrom?: number
  images: string[]
  isActive: boolean
  createdAt: string
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getHotels({ all: 'true' }).then(data => {
      setHotels(data as Hotel[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleToggle = async (hotel: Hotel) => {
    try {
      await api.updateHotel(hotel.id, { isActive: !hotel.isActive })
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, isActive: !h.isActive } : h))
    } catch { /* ignore */ }
  }

  if (loading) return <div className="p-8 text-gray-400">Carregando hoteis...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogo de Hoteis</h1>
          <p className="text-sm text-gray-500 mt-1">{hotels.length} hoteis cadastrados</p>
        </div>
        <Link href="/hotels/new" className="btn-primary">
          + Novo Hotel
        </Link>
      </div>

      {hotels.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🏨</div>
          <p>Nenhum hotel cadastrado ainda.</p>
          <Link href="/hotels/new" className="text-brand-900 underline mt-2 inline-block">Cadastrar primeiro hotel</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map(hotel => (
            <div key={hotel.id} className={`card overflow-hidden transition-opacity ${!hotel.isActive ? 'opacity-50' : ''}`}>
              {/* Imagem */}
              <div className="h-40 bg-gray-100 relative">
                {hotel.images.length > 0 ? (
                  <img
                    src={hotel.images[0]}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🏨</div>
                )}
                {!hotel.isActive && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    Inativo
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 truncate">{hotel.name}</h3>
                  {hotel.stars && (
                    <span className="text-yellow-500 text-xs">{'★'.repeat(hotel.stars)}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">{hotel.destination}</p>

                {hotel.priceFrom && (
                  <p className="text-sm font-semibold text-green-700 mb-2">
                    A partir de R$ {hotel.priceFrom.toLocaleString('pt-BR')}
                  </p>
                )}

                {hotel.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {hotel.highlights.slice(0, 4).map((h, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{h}</span>
                    ))}
                    {hotel.highlights.length > 4 && (
                      <span className="text-xs text-gray-400">+{hotel.highlights.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  <Link href={`/hotels/${hotel.id}`} className="btn-secondary text-xs flex-1 text-center">
                    Editar
                  </Link>
                  <button
                    onClick={() => handleToggle(hotel)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
                      hotel.isActive
                        ? 'text-red-600 border-red-200 hover:bg-red-50'
                        : 'text-green-600 border-green-200 hover:bg-green-50'
                    }`}
                  >
                    {hotel.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
