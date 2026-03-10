'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewHotelPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [highlightInput, setHighlightInput] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    stars: '',
    priceFrom: '',
    description: '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAddHighlight = () => {
    if (highlightInput.trim()) {
      setHighlights(prev => [...prev, highlightInput.trim()])
      setHighlightInput('')
    }
  }

  const handleRemoveHighlight = (index: number) => {
    setHighlights(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          destination: formData.destination,
          stars: formData.stars ? parseInt(formData.stars) : undefined,
          priceFrom: formData.priceFrom ? parseFloat(formData.priceFrom) : undefined,
          description: formData.description,
          highlights,
          images: [],
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Erro ao criar hotel')
      }

      router.push('/hotels')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/hotels" className="text-sm text-blue-600 hover:text-blue-800 mb-3 inline-block">
          ← Voltar para hotéis
        </Link>
        <h1 className="text-2xl font-extrabold">Novo Hotel</h1>
        <p className="text-sm text-gray-500 mt-1">Cadastre um novo hotel no catálogo</p>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200 text-red-700 mb-6">
          <div className="font-semibold">Erro</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Nome do hotel *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ex: Xcaret Resort"
              required
              className="input w-full"
            />
          </div>

          <div>
            <label className="label">Destino *</label>
            <input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleInputChange}
              placeholder="Ex: Cancun, Mexico"
              required
              className="input w-full"
            />
          </div>

          <div>
            <label className="label">Estrelas (1-5)</label>
            <input
              type="number"
              name="stars"
              value={formData.stars}
              onChange={handleInputChange}
              min="1"
              max="5"
              placeholder="Ex: 5"
              className="input w-full"
            />
          </div>

          <div>
            <label className="label">Preço a partir de (R$)</label>
            <input
              type="number"
              name="priceFrom"
              value={formData.priceFrom}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              placeholder="Ex: 2400.00"
              className="input w-full"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Descrição</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Descreva o hotel..."
            rows={3}
            className="input w-full"
          />
        </div>

        <div className="mb-4">
          <label className="label">Destaques</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={highlightInput}
              onChange={(e) => setHighlightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddHighlight()
                }
              }}
              placeholder="Ex: All Inclusive"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={handleAddHighlight}
              className="btn-primary px-4"
            >
              + Adicionar
            </button>
          </div>

          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {highlights.map((highlight, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm flex items-center gap-2"
                >
                  {highlight}
                  <button
                    type="button"
                    onClick={() => handleRemoveHighlight(i)}
                    className="text-blue-600 hover:text-blue-800 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading || !formData.name || !formData.destination}
            className="btn-primary flex-1"
          >
            {loading ? 'Salvando...' : 'Criar Hotel'}
          </button>
          <Link href="/hotels" className="btn-secondary flex-1 text-center">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
