'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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

export default function EditHotelPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<HotelForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [chipInput, setChipInput] = useState('')

  useEffect(() => {
    api.getHotel(id).then((h: any) => {
      const imgs = Array.isArray(h.images) ? h.images : []
      const hl = Array.isArray(h.highlights) ? h.highlights : []
      setForm({
        name: h.name ?? '',
        destination: h.destination ?? '',
        stars: h.stars ? String(h.stars) : '',
        description: h.description ?? '',
        highlights: hl.join(', '),
        priceFrom: h.priceFrom ? String(h.priceFrom) : '',
        images: imgs,
        isActive: h.isActive ?? true,
      })
    }).catch(err => setError(String(err)))
  }, [id])

  if (!form) return <div className="p-8 text-gray-400">{error || 'Carregando...'}</div>

  const set = (field: keyof HotelForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => prev ? { ...prev, [field]: e.target.value } : prev)

  const highlights = form.highlights ? form.highlights.split(',').map(s => s.trim()).filter(Boolean) : []

  const addHighlight = () => {
    if (!chipInput.trim()) return
    const updated = [...highlights, chipInput.trim()].join(', ')
    setForm(prev => prev ? { ...prev, highlights: updated } : prev)
    setChipInput('')
  }

  const removeHighlight = (idx: number) => {
    const updated = highlights.filter((_, i) => i !== idx).join(', ')
    setForm(prev => prev ? { ...prev, highlights: updated } : prev)
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
      setForm(prev => prev ? { ...prev, images: [...prev.images, fullUrl] } : prev)
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
    setMessage('')
    try {
      await api.updateHotel(id, {
        name: form.name,
        destination: form.destination,
        stars: form.stars ? parseInt(form.stars) : undefined,
        description: form.description || undefined,
        highlights,
        priceFrom: form.priceFrom ? parseFloat(form.priceFrom) : undefined,
        images: form.images,
        isActive: form.isActive,
      })
      setMessage('Hotel atualizado com sucesso!')
      setSaving(false)
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Hotel</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{message}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nome do Hotel *</label>
            <input value={form.name} onChange={set('name')} required className="input" />
          </div>
          <div>
            <label className="label">Destino *</label>
            <input value={form.destination} onChange={set('destination')} required className="input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Estrelas</label>
            <select value={form.stars} onChange={set('stars')} className="input">
              <option value="">--</option>
              {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n} estrela{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Preco a partir de (R$)</label>
            <input type="number" step="0.01" value={form.priceFrom} onChange={set('priceFrom')} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Descricao</label>
          <textarea value={form.description} onChange={set('description')} className="input h-24" />
        </div>

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
              placeholder="All Inclusive, Spa..."
            />
            <button type="button" onClick={addHighlight} className="btn-secondary text-xs px-3">+</button>
          </div>
        </div>

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
                    onClick={() => setForm(prev => prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : prev)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm(prev => prev ? { ...prev, isActive: e.target.checked } : prev)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Hotel ativo</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
          <button type="button" onClick={() => router.push('/hotels')} className="btn-secondary">
            Voltar
          </button>
        </div>
      </form>
    </div>
  )
}
