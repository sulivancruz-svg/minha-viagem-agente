'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api'

interface HotelForm {
  name: string
  destination: string
  stars: string
  description: string
  highlights: string
  priceFrom: string
  images: string[]
  isActive: boolean
}

const EMPTY: HotelForm = {
  name: '', destination: '', stars: '', description: '',
  highlights: '', priceFrom: '', images: [], isActive: true,
}

export default function NewHotelPage() {
  const router = useRouter()
  const [form, setForm] = useState<HotelForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [chipInput, setChipInput] = useState('')

  const set = (field: keyof HotelForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const highlights = form.highlights ? form.highlights.split(',').map(s => s.trim()).filter(Boolean) : []

  const addHighlight = () => {
    if (!chipInput.trim()) return
    const updated = [...highlights, chipInput.trim()].join(', ')
    setForm(prev => ({ ...prev, highlights: updated }))
    setChipInput('')
  }

  const removeHighlight = (idx: number) => {
    const updated = highlights.filter((_, i) => i !== idx).join(', ')
    setForm(prev => ({ ...prev, highlights: updated }))
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await api.uploadHotelImage(file)
      const fullUrl = result.mediaUrl.startsWith('/_mv/')
        ? result.mediaUrl
        : result.mediaUrl.replace('/api/', '/_mv/')
      setForm(prev => ({ ...prev, images: [...prev.images, fullUrl] }))
    } catch (err) {
      setError('Erro ao fazer upload: ' + String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.createHotel({
        name: form.name,
        destination: form.destination,
        stars: form.stars ? parseInt(form.stars) : undefined,
        description: form.description || undefined,
        highlights,
        priceFrom: form.priceFrom ? parseFloat(form.priceFrom) : undefined,
        images: form.images,
        isActive: form.isActive,
      })
      router.push('/hotels')
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Hotel</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Nome + Destino */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nome do Hotel *</label>
            <input value={form.name} onChange={set('name')} required className="input" placeholder="Xcaret Resort" />
          </div>
          <div>
            <label className="label">Destino *</label>
            <input value={form.destination} onChange={set('destination')} required className="input" placeholder="Cancun, Mexico" />
          </div>
        </div>

        {/* Estrelas + Preco */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Estrelas</label>
            <select value={form.stars} onChange={set('stars')} className="input">
              <option value="">--</option>
              <option value="1">1 estrela</option>
              <option value="2">2 estrelas</option>
              <option value="3">3 estrelas</option>
              <option value="4">4 estrelas</option>
              <option value="5">5 estrelas</option>
            </select>
          </div>
          <div>
            <label className="label">Preco a partir de (R$)</label>
            <input type="number" step="0.01" value={form.priceFrom} onChange={set('priceFrom')} className="input" placeholder="2400.00" />
          </div>
        </div>

        {/* Descricao */}
        <div>
          <label className="label">Descricao</label>
          <textarea value={form.description} onChange={set('description')} className="input h-24" placeholder="Resort all inclusive com vista para o mar..." />
        </div>

        {/* Highlights (chips) */}
        <div>
          <label className="label">Destaques</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {highlights.map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-brand-900/10 text-brand-900 px-2.5 py-1 rounded-full text-xs font-medium">
                {h}
                <button type="button" onClick={() => removeHighlight(i)} className="hover:text-red-500 ml-0.5">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={chipInput}
              onChange={e => setChipInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight() } }}
              className="input flex-1"
              placeholder="All Inclusive, Spa, Kids Club..."
            />
            <button type="button" onClick={addHighlight} className="btn-secondary text-xs px-3">+</button>
          </div>
        </div>

        {/* Upload de imagens */}
        <div>
          <label className="label">Imagens</label>
          <label className="btn-secondary cursor-pointer inline-block">
            {uploading ? 'Enviando...' : 'Upload de imagem'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          {form.images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative border rounded-lg overflow-hidden group">
                  <img src={url} alt={`Hotel ${idx + 1}`} className="w-full h-24 object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ativo */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Hotel ativo (visivel para agentes)</span>
        </label>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando...' : 'Cadastrar Hotel'}
          </button>
          <button type="button" onClick={() => router.push('/hotels')} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
