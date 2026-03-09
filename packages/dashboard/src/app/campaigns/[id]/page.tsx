'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

interface CampaignDetail {
  id: string
  name: string
  destination: string
  dateRange: string
  offerText: string
  inclusions: string[] | string
  hotels?: string[] | string
  priceFrom?: number | null
  ctaText: string
  landingUrl?: string | null
  mediaAssets?: string[] | string
  isActive: boolean
  createdAt: string
}

interface CampaignForm {
  name: string
  destination: string
  dateRange: string
  offerText: string
  inclusions: string
  hotels: string
  priceFrom: string
  ctaText: string
  landingUrl: string
  mediaAssets: string[]
  isActive: boolean
}

function asArray(v: string[] | string | undefined): string[] {
  if (Array.isArray(v)) return v
  if (!v) return []
  try {
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function CampaignDetailsPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [form, setForm] = useState<CampaignForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getCampaign(id)
      .then(data => {
        const c = data as CampaignDetail
        setCampaign(c)
        setForm({
          name: c.name ?? '',
          destination: c.destination ?? '',
          dateRange: c.dateRange ?? '',
          offerText: c.offerText ?? '',
          inclusions: asArray(c.inclusions).join('\n'),
          hotels: asArray(c.hotels).join('\n'),
          priceFrom: c.priceFrom ? String(c.priceFrom) : '',
          ctaText: c.ctaText ?? '',
          landingUrl: c.landingUrl ?? '',
          mediaAssets: asArray(c.mediaAssets),
          isActive: Boolean(c.isActive),
        })
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  const set = (field: keyof CampaignForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = e.target.type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !form) return
    setUploading(true)
    setMessage('')
    setError('')
    try {
      const result = await api.uploadCampaignMedia(file)
      const fullUrl = result.mediaUrl.startsWith('/_mv/')
        ? result.mediaUrl
        : result.mediaUrl.replace('/api/', '/_mv/')
      setForm(prev => prev ? { ...prev, mediaAssets: [...prev.mediaAssets, fullUrl] } : prev)
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !form) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        ...form,
        inclusions: form.inclusions.split('\n').map(s => s.trim()).filter(Boolean),
        hotels: form.hotels.split('\n').map(s => s.trim()).filter(Boolean),
        priceFrom: form.priceFrom ? parseFloat(form.priceFrom) : undefined,
      }
      await api.updateCampaign(id, payload)
      setMessage('Campanha atualizada com sucesso.')
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Editar campanha</h1>
          <p className="text-sm text-gray-500">Atualize oferta, hotéis e imagens</p>
        </div>
        <Link href="/campaigns" className="btn-secondary text-sm">Voltar</Link>
      </div>

      {loading && <div className="card p-6 animate-pulse h-56 bg-gray-100" />}
      {!loading && error && (
        <div className="card p-4 text-sm text-red-700 border border-red-200 bg-red-50">
          Erro: {error}
        </div>
      )}
      {!loading && !error && form && campaign && (
        <form onSubmit={handleSave} className="card p-6 space-y-5 max-w-3xl">
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome da campanha *</label>
              <input value={form.name} onChange={set('name')} required className="input" />
            </div>
            <div>
              <label className="label">Destino *</label>
              <input value={form.destination} onChange={set('destination')} required className="input" />
            </div>
            <div>
              <label className="label">Período *</label>
              <input value={form.dateRange} onChange={set('dateRange')} required className="input" />
            </div>
          </div>

          <div>
            <label className="label">Texto da oferta *</label>
            <textarea value={form.offerText} onChange={set('offerText')} required className="input h-24 resize-none" />
          </div>

          <div>
            <label className="label">Inclusões (uma por linha)</label>
            <textarea value={form.inclusions} onChange={set('inclusions')} className="input h-24 resize-none" />
          </div>

          <div>
            <label className="label">Hotéis cadastrados (um por linha)</label>
            <textarea value={form.hotels} onChange={set('hotels')} className="input h-24 resize-none" />
          </div>

          <div>
            <label className="label">Preço a partir de (R$)</label>
            <input type="number" value={form.priceFrom} onChange={set('priceFrom')} className="input" />
          </div>

          <div>
            <label className="label">CTA *</label>
            <input value={form.ctaText} onChange={set('ctaText')} required className="input" />
          </div>

          <div>
            <label className="label">Landing page</label>
            <input type="url" value={form.landingUrl} onChange={set('landingUrl')} className="input" />
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
                    <img src={url} alt={`Imagem ${idx + 1}`} className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-white/90 rounded border border-gray-300"
                      onClick={() => setForm(prev => prev ? { ...prev, mediaAssets: prev.mediaAssets.filter((_, i) => i !== idx) } : prev)}
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={set('isActive')} className="w-4 h-4" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Campanha ativa</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <Link href="/campaigns" className="btn-secondary">Cancelar</Link>
          </div>
        </form>
      )}
    </div>
  )
}
