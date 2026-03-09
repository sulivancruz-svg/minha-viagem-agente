'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface HotelOption { id: string; name: string; destination: string }

const EMPTY = {
  name:        '',
  destination: '',
  dateRange:   '',
  offerText:   '',
  inclusions:  '',  // separar por nova linha na UI
  hotels:      [] as string[],  // nomes dos hoteis selecionados do catalogo
  priceFrom:   '',
  ctaText:     'Quero receber a cotação completa!',
  landingUrl:  '',
  mediaAssets: [] as string[],
  isActive:    true,
}

export default function NewCampaignPage() {
  const router  = useRouter()
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,  setError]  = useState('')
  const [hotelOptions, setHotelOptions] = useState<HotelOption[]>([])

  useEffect(() => {
    api.getHotels().then(data => setHotelOptions(data as HotelOption[])).catch(() => {})
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.createCampaign({
        ...form,
        priceFrom:  form.priceFrom ? parseFloat(form.priceFrom) : undefined,
        inclusions: form.inclusions.split('\n').map(s => s.trim()).filter(Boolean),
        hotels: form.hotels,
      })
      router.push('/campaigns')
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await api.uploadCampaignMedia(file)
      const fullUrl = result.mediaUrl.startsWith('/_mv/')
        ? result.mediaUrl
        : result.mediaUrl.replace('/api/', '/_mv/')
      setForm(prev => ({ ...prev, mediaAssets: [...prev.mediaAssets, fullUrl] }))
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-6">Nova Campanha</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome da campanha *</label>
            <input value={form.name} onChange={set('name')} required className="input" placeholder="Ex: Cancun Julho 2025" />
          </div>
          <div>
            <label className="label">Destino *</label>
            <input value={form.destination} onChange={set('destination')} required className="input" placeholder="Ex: Cancun, Mexico" />
          </div>
          <div>
            <label className="label">Periodo *</label>
            <input value={form.dateRange} onChange={set('dateRange')} required className="input" placeholder="Ex: 05 a 12 de julho" />
          </div>
        </div>

        <div>
          <label className="label">Texto da oferta *</label>
          <textarea value={form.offerText} onChange={set('offerText')} required className="input h-24 resize-none" placeholder="Descricao curta e atrativa do pacote..." />
        </div>

        <div>
          <label className="label">O que inclui (uma por linha)</label>
          <textarea value={form.inclusions} onChange={set('inclusions')} className="input h-24 resize-none" placeholder={"Voo ida e volta\nHotel all-inclusive\nTraslados"} />
        </div>

        <div>
          <label className="label">Hoteis do catalogo</label>
          {hotelOptions.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum hotel cadastrado. <a href="/hotels/new" className="underline text-brand-900">Cadastrar</a></p>
          ) : (
            <>
              <select
                className="input"
                value=""
                onChange={e => {
                  const name = e.target.value
                  if (name && !form.hotels.includes(name)) {
                    setForm(prev => ({ ...prev, hotels: [...prev.hotels, name] }))
                  }
                }}
              >
                <option value="">-- selecionar hotel --</option>
                {hotelOptions.filter(h => !form.hotels.includes(h.name)).map(h => (
                  <option key={h.id} value={h.name}>{h.name} - {h.destination}</option>
                ))}
              </select>
              {form.hotels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.hotels.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-brand-900/10 text-brand-900 px-2.5 py-1 rounded-full text-xs font-medium">
                      {name}
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, hotels: prev.hotels.filter((_, idx) => idx !== i) }))} className="hover:text-red-500 ml-0.5">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="label">Preço a partir de (R$)</label>
          <input type="number" value={form.priceFrom} onChange={set('priceFrom')} className="input" placeholder="4890" />
        </div>

        <div>
          <label className="label">CTA (chamada para acao) *</label>
          <input value={form.ctaText} onChange={set('ctaText')} required className="input" />
        </div>

        <div>
          <label className="label">Link da landing page</label>
          <input type="url" value={form.landingUrl} onChange={set('landingUrl')} className="input" placeholder="https://..." />
        </div>

        <div>
          <label className="label">Imagem da campanha</label>
          <div className="flex items-center gap-3">
            <label className="btn-secondary cursor-pointer">
              {uploading ? 'Enviando imagem...' : 'Upload de imagem'}
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={uploading} />
            </label>
            <span className="text-xs text-gray-500">PNG/JPG ate 6MB</span>
          </div>
          {form.mediaAssets.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {form.mediaAssets.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Campanha" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-white/90 rounded border border-gray-300"
                    onClick={() => setForm(prev => ({ ...prev, mediaAssets: prev.mediaAssets.filter((_, i) => i !== idx) }))}
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            className="w-4 h-4"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">Campanha ativa</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando...' : 'Criar campanha'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
