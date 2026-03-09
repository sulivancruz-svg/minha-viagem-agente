// Painel de envio assistido com OfferBuilder.
// Preenche a caixa do WhatsApp, mas nunca envia automaticamente.

import React, { useEffect, useMemo, useState } from 'react'
import type { Campaign, DetectedChat, Hotel } from '../shared/types'

interface Props {
  campaigns: Campaign[]
  currentChat: DetectedChat
  contactId?: string
  disableActions?: boolean
}

type FillStatus = 'idle' | 'ready' | 'error'
type ImageOption = {
  key: string
  url: string
  label: string
}

const COMPOSE_SEL = [
  '[data-testid="conversation-compose-box-input"]',
  'div[contenteditable="true"][data-tab="10"]',
  'footer div[contenteditable="true"]',
  'div[role="textbox"][data-lexical-editor="true"]',
]

function safeSendMessage<T = unknown>(
  message: unknown,
  onResponse: (response: T | undefined, runtimeError?: string) => void,
) {
  try {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        onResponse(undefined, chrome.runtime.lastError.message)
        return
      }
      onResponse(response as T, undefined)
    })
  } catch {
    onResponse(undefined, 'Falha ao enviar mensagem para o background')
  }
}

function getComposeBox(): HTMLElement | null {
  for (const sel of COMPOSE_SEL) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) return el
  }
  return null
}

function fillCompose(text: string): boolean {
  const box = getComposeBox()
  if (!box) return false
  box.focus()
  document.execCommand('selectAll', false)
  document.execCommand('insertText', false, text)
  box.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
  return true
}

function brl(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return `R$ ${value.toLocaleString('pt-BR')}`
}

function campaignHotelRefs(campaign?: Campaign): string[] {
  if (!campaign) return []
  const fromIds = Array.isArray(campaign.hotelIds) ? campaign.hotelIds : []
  const fromHotels = Array.isArray(campaign.hotels) ? campaign.hotels : []
  return Array.from(new Set([...fromIds, ...fromHotels].map(v => String(v || '').trim()).filter(Boolean)))
}

function parseLines(text: string): string[] {
  return text.split('\n').map(v => v.trim()).filter(Boolean)
}

function buildImageOptions(campaign?: Campaign, hotel?: Hotel | null, allCampaigns: Campaign[] = []): ImageOption[] {
  const options: ImageOption[] = []
  const seen = new Set<string>()

  const hotelImages = Array.isArray(hotel?.images) ? hotel?.images : []
  hotelImages.forEach((url, index) => {
    const clean = String(url || '').trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    options.push({
      key: `hotel:${index}`,
      url: clean,
      label: `Hotel (${index + 1})`,
    })
  })

  const campaignImages = Array.isArray(campaign?.mediaAssets) ? campaign?.mediaAssets : []
  campaignImages.forEach((url, index) => {
    const clean = String(url || '').trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    options.push({
      key: `campaign:${index}`,
      url: clean,
      label: `Campanha (${index + 1})`,
    })
  })

  for (const camp of allCampaigns) {
    if (camp.id === campaign?.id) continue
    const assets = Array.isArray(camp.mediaAssets) ? camp.mediaAssets : []
    assets.forEach((url, index) => {
      const clean = String(url || '').trim()
      if (!clean || seen.has(clean)) return
      seen.add(clean)
      options.push({
        key: `campaign-all:${camp.id}:${index}`,
        url: clean,
        label: `Campanha ${camp.name} (${index + 1})`,
      })
    })
  }

  return options
}

function buildAssistedMessage(params: {
  chatName: string
  campaign?: Campaign
  hotel?: Hotel
  offerText: string
  highlightsText: string
  priceText: string
  landingUrl: string
  imageUrl: string
}): string {
  const first = params.chatName.split(' ')[0] || params.chatName
  const titleHotel = params.hotel?.name ? `${params.hotel.name} - ${params.hotel.destination}` : ''
  const lines: string[] = [
    `Ola, ${first}!`,
    '',
    `*${params.campaign?.destination ?? 'Oferta de viagem'}* | ${params.campaign?.dateRange ?? ''}`.trim(),
  ]

  if (titleHotel) lines.push('', `Hotel sugerido: *${titleHotel}*`)
  if (params.offerText.trim()) lines.push('', params.offerText.trim())

  const highlights = parseLines(params.highlightsText)
  if (highlights.length > 0) {
    lines.push('', '*Destaques:*')
    highlights.forEach(item => lines.push(`- ${item}`))
  }

  if (params.priceText.trim()) lines.push('', `A partir de *${params.priceText.trim()}*`)
  if (params.imageUrl.trim()) lines.push('', `Imagem: ${params.imageUrl.trim()}`)
  if (params.landingUrl.trim()) lines.push('', `Mais detalhes: ${params.landingUrl.trim()}`)

  if (params.campaign?.ctaText) lines.push('', params.campaign.ctaText)
  lines.push('', '_Para nao receber mais, responda SAIR._')
  return lines.join('\n')
}

export function CampaignSender({ campaigns, currentChat, contactId: _contactId, disableActions = false }: Props) {
  const [catalogHotels, setCatalogHotels] = useState<Hotel[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [offerText, setOfferText] = useState('')
  const [highlightsText, setHighlightsText] = useState('')
  const [priceText, setPriceText] = useState('')
  const [landingUrl, setLandingUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedImageKey, setSelectedImageKey] = useState('')
  const [imageActionMsg, setImageActionMsg] = useState('')
  const [imagePreviewSrc, setImagePreviewSrc] = useState('')
  const [preview, setPreview] = useState('')
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle')

  const activeCampaigns = useMemo(() => campaigns.filter(c => c.isActive), [campaigns])
  const selectedCampaign = useMemo(
    () => activeCampaigns.find(c => c.id === selectedCampaignId),
    [activeCampaigns, selectedCampaignId],
  )
  const hotelById = useMemo(() => new Map(catalogHotels.map(h => [h.id, h])), [catalogHotels])

  const selectedCampaignHotels = useMemo(() => {
    if (!selectedCampaign) return [] as Hotel[]
    const refs = campaignHotelRefs(selectedCampaign)
    const fromIds = refs.map(ref => hotelById.get(ref)).filter(Boolean) as Hotel[]
    if (fromIds.length > 0) return fromIds
    const refsLower = refs.map(v => v.toLowerCase())
    return catalogHotels.filter(h => refsLower.includes(h.name.toLowerCase()))
  }, [catalogHotels, hotelById, selectedCampaign])

  const selectedHotel = useMemo(
    () => selectedCampaignHotels.find(h => h.id === selectedHotelId) ?? null,
    [selectedCampaignHotels, selectedHotelId],
  )
  const imageOptions = useMemo(
    () => buildImageOptions(selectedCampaign, selectedHotel, activeCampaigns),
    [activeCampaigns, selectedCampaign, selectedHotel],
  )

  useEffect(() => {
    safeSendMessage<{ hotels?: Hotel[] }>({ type: 'GET_HOTELS' }, (res) => {
      if (Array.isArray(res?.hotels)) setCatalogHotels(res.hotels)
    })
  }, [])

  useEffect(() => {
    if (!selectedCampaignId && activeCampaigns.length > 0) {
      setSelectedCampaignId(activeCampaigns[0].id)
    }
  }, [activeCampaigns, selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaign) return
    if (selectedCampaignHotels.length === 0) {
      setSelectedHotelId('')
      return
    }
    if (!selectedHotelId || !selectedCampaignHotels.some(h => h.id === selectedHotelId)) {
      setSelectedHotelId(selectedCampaignHotels[0].id)
    }
  }, [selectedCampaign, selectedCampaignHotels, selectedHotelId])

  useEffect(() => {
    if (!selectedCampaign) {
      setOfferText('')
      setHighlightsText('')
      setPriceText('')
      setLandingUrl('')
      setImageUrl('')
      setSelectedImageKey('')
      setImageActionMsg('')
      setPreview('')
      return
    }

    const fallbackHighlights = Array.isArray(selectedCampaign.inclusions) ? selectedCampaign.inclusions : []
    setOfferText(selectedCampaign.offerText ?? '')
    setHighlightsText((selectedHotel?.highlights?.length ? selectedHotel.highlights : fallbackHighlights).join('\n'))
    setPriceText(brl(selectedHotel?.priceFrom ?? selectedCampaign.priceFrom))
    setLandingUrl(selectedCampaign.landingUrl ?? '')
    setImageActionMsg('')
    setFillStatus('idle')
  }, [selectedCampaign, selectedHotel])

  useEffect(() => {
    if (!selectedCampaign) return
    if (imageOptions.length === 0) {
      setSelectedImageKey('')
      setImageUrl('')
      return
    }
    const current = imageOptions.find(opt => opt.key === selectedImageKey)
    if (current) {
      setImageUrl(current.url)
      return
    }
    setSelectedImageKey(imageOptions[0].key)
    setImageUrl(imageOptions[0].url)
  }, [imageOptions, selectedCampaign, selectedImageKey])

  useEffect(() => {
    const raw = String(imageUrl || '').trim()
    if (!raw) {
      setImagePreviewSrc('')
      return
    }

    let revoked = false
    let objectUrl = ''

    const load = async () => {
      try {
        const response = await fetch(raw)
        const blob = await response.blob()
        if (!blob || !blob.size || revoked) {
          setImagePreviewSrc(raw)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        if (!revoked) setImagePreviewSrc(objectUrl)
      } catch {
        setImagePreviewSrc(raw)
      }
    }

    load()
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  useEffect(() => {
    setPreview(buildAssistedMessage({
      chatName: currentChat.name,
      campaign: selectedCampaign,
      hotel: selectedHotel ?? undefined,
      offerText,
      highlightsText,
      priceText,
      landingUrl,
      imageUrl,
    }))
  }, [currentChat.name, imageUrl, highlightsText, landingUrl, offerText, priceText, selectedCampaign, selectedHotel])

  const handlePrepare = () => {
    if (!preview.trim()) return
    const ok = fillCompose(preview)
    setFillStatus(ok ? 'ready' : 'error')
  }

  if (activeCampaigns.length === 0) {
    return (
      <div style={{ padding: 16, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>[ ]</div>
        Nenhuma campanha ativa. Crie uma no dashboard.
      </div>
    )
  }

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      {disableActions && (
        <div style={warnBox}>
          Nao consegui capturar o numero deste chat ainda.
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Campanha:</label>
        <select
          disabled={disableActions}
          value={selectedCampaignId}
          onChange={e => setSelectedCampaignId(e.target.value)}
          style={sel}
        >
          {activeCampaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name} | {c.destination}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Hotel da campanha:</label>
        <select
          disabled={disableActions || selectedCampaignHotels.length === 0}
          value={selectedHotelId}
          onChange={e => setSelectedHotelId(e.target.value)}
          style={sel}
        >
          {selectedCampaignHotels.length === 0 && (
            <option value="">Sem hotel vinculado na campanha</option>
          )}
          {selectedCampaignHotels.map(h => (
            <option key={h.id} value={h.id}>
              {h.name} | {h.destination} {h.priceFrom ? `| ${brl(h.priceFrom)}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Texto da oferta:</label>
        <textarea value={offerText} onChange={e => setOfferText(e.target.value)} style={txt} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Highlights:</label>
        <textarea value={highlightsText} onChange={e => setHighlightsText(e.target.value)} style={txt} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={priceText}
          onChange={e => setPriceText(e.target.value)}
          style={inp}
          placeholder="Preco (ex.: R$ 4.990)"
        />
        <input
          value={landingUrl}
          onChange={e => setLandingUrl(e.target.value)}
          style={inp}
          placeholder="Link da oferta"
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Imagem da oferta:</label>
        <select
          disabled={disableActions || imageOptions.length === 0}
          value={selectedImageKey}
          onChange={e => {
            const nextKey = e.target.value
            const selected = imageOptions.find(opt => opt.key === nextKey)
            setSelectedImageKey(nextKey)
            setImageUrl(selected?.url ?? '')
            setImageActionMsg('')
          }}
          style={sel}
        >
          {imageOptions.length === 0 && (
            <option value="">Sem imagem cadastrada (hotel/campanha)</option>
          )}
          {imageOptions.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <input
          value={imageUrl}
          onChange={e => {
            setImageUrl(e.target.value)
            setSelectedImageKey('')
            setImageActionMsg('')
          }}
          style={inp}
          placeholder="Imagem (URL)"
        />
      </div>

      {imageUrl.trim() && (
        <div style={mediaBox}>
          <img src={imagePreviewSrc || imageUrl} alt="Oferta selecionada" style={mediaImage} />
          <button
            disabled={disableActions}
            onClick={async () => {
              try {
                const resp = await fetch(imageUrl)
                const blob = await resp.blob()
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
                setImageActionMsg('Imagem copiada. Cole no WhatsApp com Ctrl+V.')
              } catch {
                setImageActionMsg('Nao foi possivel copiar a imagem selecionada.')
              }
            }}
            style={{ ...copyBtn, opacity: disableActions ? 0.6 : 1, cursor: disableActions ? 'not-allowed' : 'pointer' }}
          >
            Copiar imagem
          </button>
        </div>
      )}

      {imageActionMsg && (
        <div style={{ marginBottom: 8, fontSize: 11, color: '#475569' }}>
          {imageActionMsg}
        </div>
      )}

      <div style={previewBox}>
        {preview}
      </div>

      {fillStatus === 'idle' && (
        <button
          disabled={disableActions}
          onClick={handlePrepare}
          style={{ ...primaryBtn, opacity: disableActions ? 0.6 : 1, cursor: disableActions ? 'not-allowed' : 'pointer' }}
        >
          Preparar envio (preencher mensagem)
        </button>
      )}

      {fillStatus === 'ready' && (
        <div style={alertBox('#fef9c3', '#fde68a', '#854d0e')}>
          <strong>Mensagem pronta na caixa do WhatsApp.</strong><br />
          Clique no botao de envio do WhatsApp para confirmar.
        </div>
      )}

      {fillStatus === 'error' && (
        <div style={alertBox('#fef2f2', '#fecaca', '#b91c1c')}>
          Nao foi possivel preencher. Certifique-se de que uma conversa esta aberta.
          <button onClick={handlePrepare} style={retryBtn}>
            Tentar novamente
          </button>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
        OfferBuilder assistido: prepara o texto, voce revisa e envia manualmente.
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }
const sel: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }
const txt: React.CSSProperties = { width: '100%', minHeight: 56, padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, resize: 'vertical' }
const inp: React.CSSProperties = { flex: 1, width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 8, background: '#16a34a', color: '#fff',
  border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer',
}
const warnBox: React.CSSProperties = {
  marginBottom: 10, padding: 8, background: '#fef9c3', border: '1px solid #fde68a',
  borderRadius: 6, fontSize: 12, color: '#854d0e',
}
const previewBox: React.CSSProperties = {
  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
  padding: 10, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6,
  maxHeight: 220, overflowY: 'auto', color: '#166534', marginBottom: 8,
}
const retryBtn: React.CSSProperties = {
  marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none',
  cursor: 'pointer', color: '#b91c1c', fontSize: 12,
}
const mediaBox: React.CSSProperties = {
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}
const mediaImage: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 6,
  objectFit: 'cover',
  border: '1px solid #cbd5e1',
  background: '#fff',
}
const copyBtn: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
}
const alertBox = (bg: string, border: string, text: string): React.CSSProperties => ({
  padding: 10, background: bg, border: `1px solid ${border}`, borderRadius: 6,
  fontSize: 12, color: text, lineHeight: 1.5,
})
