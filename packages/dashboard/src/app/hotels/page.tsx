'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoreHorizontal, Plus, Edit, Trash2, Star } from 'lucide-react'

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
  const [search, setSearch] = useState('')
  const [destination, setDestination] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])

  useEffect(() => {
    fetchHotels()
  }, [search, destination])

  const fetchHotels = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (destination) params.append('destination', destination)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hotels?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setHotels(data.hotels || [])

        // Extract unique destinations
        const uniqueDests = [...new Set(data.hotels.map((h: Hotel) => h.destination))]
        setDestinations(uniqueDests)
      }
    } catch (error) {
      console.error('Erro ao carregar hotéis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (hotelId: string) => {
    if (!confirm('Tem certeza que deseja desativar este hotel?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hotels/${hotelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (response.ok) {
        setHotels(hotels.filter(h => h.id !== hotelId))
      }
    } catch (error) {
      console.error('Erro ao desativar hotel:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catálogo de Hotéis</h1>
          <p className="text-gray-500 mt-1">Gerenciador de hotéis para campanhas de vendas</p>
        </div>
        <Link href="/hotels/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Hotel
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Buscar por nome ou destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por destino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os destinos</SelectItem>
                {destinations.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Hotéis */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando hotéis...</p>
        </div>
      ) : hotels.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">Nenhum hotel cadastrado ainda</p>
            <Link href="/hotels/new">
              <Button variant="outline">Criar primeiro hotel</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map(hotel => (
            <Card key={hotel.id} className="flex flex-col">
              {/* Imagem do Hotel */}
              {hotel.images && hotel.images.length > 0 && (
                <div className="h-40 bg-gray-200 overflow-hidden rounded-t-lg">
                  <img
                    src={hotel.images[0]}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{hotel.name}</CardTitle>
                    <CardDescription>{hotel.destination}</CardDescription>
                  </div>
                  {hotel.stars && (
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < hotel.stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Highlights */}
                {hotel.highlights && hotel.highlights.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {hotel.highlights.slice(0, 3).map((h, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {h}
                      </Badge>
                    ))}
                    {hotel.highlights.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{hotel.highlights.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Preço */}
                {hotel.priceFrom && (
                  <p className="mt-3 text-lg font-semibold text-green-600">
                    A partir de R$ {hotel.priceFrom.toLocaleString('pt-BR')}
                  </p>
                )}
              </CardHeader>

              {/* Ações */}
              <CardContent className="pt-0 border-t">
                <div className="flex gap-2 mt-4">
                  <Link href={`/hotels/${hotel.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(hotel.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
