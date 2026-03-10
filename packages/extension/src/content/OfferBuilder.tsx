// Componente para montar e enviar ofertas de hotéis personalizadas
// Integrado aos cards da fila

import React, { useState, useMemo } from 'react'
import type { Campaign, Hotel } from '../shared/types'

interface Props {
  contactName: string
  hotels: Hotel[]
  campaigns: Campaign[]
  onSendOffer?: (data: { campaignId?: string; hotelId: string; message: string }) => void
  onError?: (msg: string) => void
}

interface OfferDraft {
  selectedHotelId: string
  selectedCampaignId?: string
  customText?: string
  selectedImageIndex: number // qual imagem será copiada
}

interface UploadedImage {
  url: string
  uploading?: boolean
  error?: string
}

export function OfferBuilder({
  contactName,
  hotels,
  campaigns,
  onSendOffer,
  onError,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<OfferDraft>({
    selectedHotelId: hotels[0]?.id ?? '',
    selectedCampaignId: campaigns[0]?.id ?? '',
    customText: '',
    selectedImageIndex: 0,
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const selectedHotel = useMemo(
    () => hotels.find(h => h.id === draft.selectedHotelId) ?? null,
    [hotels, draft.selectedHotelId],
  )


  // Monta preview da mensagem
  const messagePreview = useMemo(() => {
    if (!selectedHotel) return ''

    const hotelInfo = [
      `🏨 ${selectedHotel.name}`,
      selectedHotel.destination && `📍 ${selectedHotel.destination}`,
      selectedHotel.stars && `⭐ ${selectedHotel.stars}`,
      selectedHotel.priceFrom && `💰 A partir de R$ ${selectedHotel.priceFrom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ]
      .filter(Boolean)
      .join('\n')

    const highlights = selectedHotel.highlights.length > 0
      ? `\n✨ Destaques:\n${selectedHotel.highlights.map(h => `  • ${h}`).join('\n')}`
      : ''

    const customPart = draft.customText
      ? `\n\n${draft.customText}`
      : ''

    return `Oi ${contactName}! 👋\n\n${hotelInfo}${highlights}${customPart}\n\nInteressado? Posso enviar mais detalhes!`
  }, [selectedHotel, draft.customText, contactName])

  // Combina imagens do hotel + uploadadas
  const allImages = useMemo(() => {
    return [
      ...(selectedHotel?.images || []),
      ...uploadedImages.map(u => u.url),
    ]
  }, [selectedHotel, uploadedImages])

  const copyImageToClipboard = async () => {
    const imagesToUse = allImages
    if (!imagesToUse || imagesToUse.length === 0) {
      onError?.('Nenhuma imagem disponível para copiar')
      return
    }

    try {
      const imageUrl = imagesToUse[draft.selectedImageIndex] || imagesToUse[0]
      const response = await fetch(imageUrl)
      const blob = await response.blob()

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ])

      return true
    } catch (err) {
      onError?.(`Erro ao copiar imagem: ${err instanceof Error ? err.message : 'desconhecido'}`)
      return false
    }
  }

  const handleUploadImage = async (file: File) => {
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      onError?.('Apenas imagens são suportadas no upload')
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError?.('Imagem muito grande (máximo 5MB)')
      return
    }

    const tempImage: UploadedImage = { url: '', uploading: true }
    setUploadedImages(prev => [...prev, tempImage])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/hotels/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Erro ao fazer upload')
      }

      const data = await response.json() as { url: string }

      // Atualizar imagem com URL
      setUploadedImages(prev =>
        prev.map(img =>
          img === tempImage ? { url: data.url, uploading: false } : img
        )
      )
    } catch (err) {
      onError?.(`Erro no upload: ${err instanceof Error ? err.message : 'desconhecido'}`)
      setUploadedImages(prev => prev.filter(img => img !== tempImage))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUploadImage(file)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const fillComposeBox = (text: string) => {
    // Tenta encontrar o input de compose do WhatsApp
    const composeInput = document.querySelector('[contenteditable="true"]') as HTMLElement
    if (!composeInput) {
      onError?.('Não consegui encontrar a caixa de mensagem. Abra um chat primeiro.')
      return false
    }

    composeInput.textContent = text
    composeInput.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  const handleSendOffer = async () => {
    if (!selectedHotel) {
      onError?.('Selecione um hotel primeiro')
      return
    }

    setSending(true)

    try {
      // 1. Copiar imagem para clipboard
      const imageCopied = await copyImageToClipboard()

      // 2. Preencher compose box com mensagem
      const fillOk = fillComposeBox(messagePreview)

      if (!fillOk) {
        setSending(false)
        return
      }

      // 3. Registrar envio no backend
      if (onSendOffer) {
        onSendOffer({
          campaignId: draft.selectedCampaignId,
          hotelId: selectedHotel.id,
          message: messagePreview,
        })
      }

      // 4. Feedback visual
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setExpanded(false)
      }, 2000)

      // Toast
      const toastMsg = imageCopied
        ? 'Imagem copiada! Cole (Ctrl+V) no WhatsApp e envie.'
        : 'Mensagem pronta! Cole a imagem (se necessário) e envie.'

      console.log(`✅ ${toastMsg}`)
    } catch (err) {
      onError?.(`Erro ao enviar oferta: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setSending(false)
    }
  }

  if (hotels.length === 0) {
    return null // Não mostra se não há hotéis disponíveis
  }

  return (
    <div style={styles.wrap}>
      {/* Botão colapsável */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={styles.toggleBtn}
        disabled={sending}
      >
        {expanded ? '▼' : '▶'} Montar Oferta com Hotel
      </button>

      {/* Formulário expandido */}
      {expanded && (
        <div style={styles.form}>
          {/* Seleção de Hotel */}
          <div style={styles.field}>
            <label style={styles.label}>Hotel:</label>
            <select
              value={draft.selectedHotelId}
              onChange={e => setDraft({ ...draft, selectedHotelId: e.target.value })}
              style={styles.select}
              disabled={sending}
            >
              {hotels.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} • {h.destination}
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Campanha (opcional) */}
          {campaigns.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Campanha (opcional):</label>
              <select
                value={draft.selectedCampaignId ?? ''}
                onChange={e => setDraft({ ...draft, selectedCampaignId: e.target.value || undefined })}
                style={styles.select}
                disabled={sending}
              >
                <option value="">-- Sem campanha --</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Info do Hotel Selecionado */}
          {selectedHotel && (
            <div style={styles.hotelInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Preço:</span>
                <span style={styles.infoValue}>
                  {selectedHotel.priceFrom
                    ? `R$ ${selectedHotel.priceFrom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'Consultar'}
                </span>
              </div>

              {selectedHotel.highlights.length > 0 && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Destaques:</span>
                  <div style={styles.badgesWrap}>
                    {selectedHotel.highlights.map(h => (
                      <span key={h} style={styles.badge}>{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {allImages.length > 0 && (
                <div style={styles.imagesWrap}>
                  <span style={styles.infoLabel}>Imagens ({allImages.length}):</span>
                  <div style={styles.thumbs}>
                    {allImages.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDraft({ ...draft, selectedImageIndex: i })}
                        title={draft.selectedImageIndex === i ? 'Selecionada' : 'Clique para selecionar'}
                        style={{
                          ...styles.thumb,
                          border: draft.selectedImageIndex === i ? '3px solid #10b981' : '1px solid #cbd5e1',
                          background: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <img
                          src={img}
                          alt={`Imagem ${i + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      ...styles.uploadBtn,
                      marginTop: 8,
                      width: '100%',
                    }}
                  >
                    + Upload Imagem
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Texto Customizado */}
          <div style={styles.field}>
            <label style={styles.label}>Mensagem adicional (opcional):</label>
            <textarea
              value={draft.customText}
              onChange={e => setDraft({ ...draft, customText: e.target.value })}
              placeholder="Ex: Tenho uma promoção especial esta semana..."
              style={styles.textarea}
              disabled={sending}
            />
          </div>

          {/* Preview */}
          <div style={styles.preview}>
            <div style={styles.previewLabel}>Preview:</div>
            <div style={styles.previewBox}>
              {messagePreview.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div style={styles.actions}>
            <button
              onClick={handleSendOffer}
              disabled={sending || !selectedHotel}
              style={styles.sendBtn}
            >
              {sending ? '⏳ Enviando...' : sent ? '✅ Oferecido!' : '📤 Enviar Oferta'}
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={styles.cancelBtn}
              disabled={sending}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Estilos inline
const styles = {
  wrap: {
    marginTop: 10,
    padding: 0,
    fontSize: 13,
  } as React.CSSProperties,

  toggleBtn: {
    width: '100%',
    padding: '8px 12px',
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left' as const,
    marginBottom: 0,
  } as React.CSSProperties,

  form: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px 6px 6px 6px',
    padding: 12,
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  } as React.CSSProperties,

  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#334155',
  } as React.CSSProperties,

  select: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    background: '#fff',
  } as React.CSSProperties,

  textarea: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontFamily: 'inherit',
    minHeight: 60,
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  hotelInfo: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    padding: 10,
    fontSize: 12,
  } as React.CSSProperties,

  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,

  infoLabel: {
    fontWeight: 600,
    color: '#475569',
    minWidth: 70,
  } as React.CSSProperties,

  infoValue: {
    color: '#1e293b',
  } as React.CSSProperties,

  badgesWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    flex: 1,
  } as React.CSSProperties,

  badge: {
    background: '#dbeafe',
    color: '#0c4a6e',
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 500,
  } as React.CSSProperties,

  imagesWrap: {
    marginTop: 8,
  } as React.CSSProperties,

  thumbs: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  } as React.CSSProperties,

  thumb: {
    width: 50,
    height: 50,
    borderRadius: 4,
    objectFit: 'cover' as const,
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  } as React.CSSProperties,

  preview: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    padding: 10,
  } as React.CSSProperties,

  previewLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 6,
  } as React.CSSProperties,

  previewBox: {
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as const,
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: 6,
  } as React.CSSProperties,

  sendBtn: {
    flex: 1,
    padding: '8px 12px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,

  cancelBtn: {
    flex: 1,
    padding: '8px 12px',
    background: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,

  uploadBtn: {
    padding: '6px 10px',
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
}
