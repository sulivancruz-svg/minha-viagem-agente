'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Hotel {
  id: string
  name: string
  destination: string
  stars?: number
  description?: string
  priceFrom?: number
  highlights: string[]
  images: string[]
  isActive: boolean
  createdAt: string
}

export default function HotelDetailPage() {
  const router = useRouter()
  const params = useParams()
  const hotelId = params.id as string

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hotelId) return

    api
      .getHotel(hotelId)
      .then((data) => setHotel(data as Hotel))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [hotelId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <div className="animate-spin">⏳</div>
          <div className="mt-4 text-gray-600">Carregando hotel...</div>
        </div>
      </div>
    )
  }

  if (error || !hotel) {
    return (
      <div className="p-8">
        <Link href="/hotels" className="text-sm text-blue-600 hover:text-blue-800 mb-3 inline-block">
          ← Voltar para hotéis
        </Link>
        <div className="card p-6 bg-red-50 border border-red-200">
          <div className="text-red-800 font-semibold">{error || 'Hotel não encontrado'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link href="/hotels" className="text-sm text-blue-600 hover:text-blue-800 mb-3 inline-block">
        ← Voltar para hotéis
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">{hotel.name}</h1>
            <p className="text-gray-600 mt-1">{hotel.destination}</p>
          </div>
          <span
            className={`px-3 py-1 rounded font-semibold text-sm ${
              hotel.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {hotel.isActive ? '✓ Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Imagens */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-4">Galeria</h2>
            {hotel.images && hotel.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {hotel.images.map((img, i) => (
                  <div key={i} className="bg-gray-100 rounded overflow-hidden h-40">
                    <img
                      src={img}
                      alt={`${hotel.name} ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <div className="text-3xl mb-2">📷</div>
                <div>Nenhuma imagem cadastrada</div>
              </div>
            )}
          </div>

          {/* Descrição */}
          {hotel.description && (
            <div className="card p-6 mt-6">
              <h2 className="font-bold text-lg mb-4">Descrição</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{hotel.description}</p>
            </div>
          )}
        </div>

        {/* Info lateral */}
        <div>
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-4">Informações</h2>

            {hotel.stars && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-semibold">ESTRELAS</div>
                <div className="text-2xl mt-1">{'⭐'.repeat(hotel.stars)}</div>
              </div>
            )}

            {hotel.priceFrom && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-xs text-gray-500 font-semibold">PREÇO A PARTIR DE</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  R$ {hotel.priceFrom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {hotel.highlights && hotel.highlights.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="text-xs text-gray-500 font-semibold mb-2">DESTAQUES</div>
                <div className="flex flex-wrap gap-1">
                  {hotel.highlights.map((highlight, i) => (
                    <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              <div className="font-semibold mb-1">CRIADO EM</div>
              <div>{new Date(hotel.createdAt).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div className="card p-6 mt-6">
            <button className="btn-primary w-full mb-2">📝 Editar Hotel</button>
            <button className="btn-secondary w-full">🗑️ Deletar Hotel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
