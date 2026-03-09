// SalesShell â€” UI principal de vendas v3
// Modos: Disparar | Responder | PÃ³s
// Inline styles apenas (sem Tailwind, shadow DOM isolado)

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Campaign, Hotel, ContactListItem, CurrentChatState, MetricsOverview, MetricsSends, PendingSend } from '../shared/types'

// â”€â”€ Tipos locais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ActiveTab = 'disparar' | 'responder' | 'pos'
type DisparStep = 'oferta' | 'publico' | 'mensagem' | 'envio'

interface Props {
  currentChat: CurrentChatState | null
  onClose?: () => void
}

interface ContactResult {
  contacts: ContactListItem[]
  total: number
  page: number
  limit: number
}

interface CampaignsResult {
  campaigns: Campaign[]
}

interface HotelsResult {
  hotels: Hotel[]
}

interface PingResult {
  authenticated?: boolean
  error?: string
}

interface PendingSendsResult {
  sends?: PendingSend[]
}

interface MarkRepliedResult {
  ok?: boolean
  error?: string
}

interface MetricsOverviewResult {
  overview?: MetricsOverview
}

interface MetricsSendsResult {
  sendsMetrics?: MetricsSends
  ok?: boolean
  error?: string
  campaignId?: string
}

interface BatchContact {
  id: string
  name: string
  phoneE164: string
  text: string
}

interface BatchState {
  running: boolean
  contacts: BatchContact[]
  index: number
  sent: number
  failed: number
}

interface OfferImageOption {
  key: string
  url: string
  label: string
}

const BATCH_STATE_KEY = 'mv_batch_state'
const BATCH_RESPONSE_TIMEOUT_MS = 180000

// â”€â”€ UtilitÃ¡rios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function safeSendMessage<T = unknown>(
  message: unknown,
  onResponse?: (res: T | undefined, err?: string) => void,
) {
  try {
    chrome.runtime.sendMessage(message, res => {
      const err = chrome.runtime.lastError?.message
      onResponse?.(res as T | undefined, err)
    })
  } catch (e) {
    onResponse?.(undefined, String(e))
  }
}

function getComposeInput(): HTMLElement | null {
  const preferred = document.querySelector<HTMLElement>('[data-testid="conversation-compose-box-input"]')
  if (preferred) return preferred

  const roots = [
    document.querySelector('#main'),
    document.querySelector('[data-testid="conversation-panel-wrapper"]'),
    document.body,
  ].filter(Boolean) as Element[]

  const candidates = roots
    .flatMap(root => Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]')))
    .filter((el, idx, arr) => arr.indexOf(el) === idx)

  for (const el of candidates) {
    if (!el.isConnected) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 40 || rect.height < 18) continue
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue

    const text = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`.toLowerCase()
    const isSearch =
      text.includes('search') ||
      text.includes('pesquisar') ||
      text.includes('procurar') ||
      text.includes('busca')
    if (isSearch) continue

    const inFooter = Boolean(el.closest('footer'))
    const inCompose = Boolean(el.closest('[data-testid="conversation-compose-box"]'))
    const maybeMessageBox = text.includes('message') || text.includes('mensagem')
    if (inFooter || inCompose || maybeMessageBox) return el
  }

  return null
}

function fillCompose(text: string): boolean {
  const input = getComposeInput()
  if (!input) return false
  input.focus()
  document.execCommand('selectAll', false)
  document.execCommand('insertText', false, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

function getComposeText(): string {
  const input = getComposeInput()
  if (!input) return ''
  const text = (input as HTMLElement).innerText ?? input.textContent ?? ''
  return String(text).trim()
}

function hasComposeDraft(): boolean {
  return getComposeText().length > 0
}

function clearComposeDraft(): boolean {
  const input = getComposeInput()
  if (!input) return false
  input.focus()
  document.execCommand('selectAll', false)
  document.execCommand('delete', false)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return getComposeText().length === 0
}

function clickSendButton(): boolean {
  const selectors = [
    '[data-testid="compose-btn-send"]',
    'button[aria-label*="Enviar" i]',
    'button[aria-label*="Send" i]',
    'span[data-icon="send"]',
  ]

  const roots = [
    document.querySelector('#main footer'),
    document.querySelector('[data-testid="conversation-panel-wrapper"] footer'),
    document.querySelector('[data-testid="conversation-compose-box"]')?.parentElement,
    document,
  ].filter(Boolean) as Array<ParentNode>

  for (const root of roots) {
    for (const sel of selectors) {
      const el = root.querySelector(sel)
      if (!(el instanceof HTMLElement)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue

      const target = (el.closest('button') as HTMLElement | null) ?? el
      const ariaDisabled = target.getAttribute('aria-disabled') === 'true'
      const disabled = (target as HTMLButtonElement).disabled === true
      if (ariaDisabled || disabled) continue

      target.focus()
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      if (typeof (target as HTMLElement).click === 'function') (target as HTMLElement).click()
      return true
    }
  }

  return false
}

function sendByEnter(): boolean {
  const input = getComposeInput()
  if (!input) return false
  input.focus()
  const evtInit: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  }
  input.dispatchEvent(new KeyboardEvent('keydown', evtInit))
  input.dispatchEvent(new KeyboardEvent('keypress', evtInit))
  input.dispatchEvent(new KeyboardEvent('keyup', evtInit))
  return true
}

async function trySendCurrentMessage(maxAttempts = 3): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const before = getComposeText()
    if (!before) {
      await sleep(250)
      continue
    }

    const clicked = clickSendButton()
    if (!clicked) {
      getComposeInput()?.focus()
      sendByEnter()
    }

    await sleep(550)
    const after = getComposeText()
    if (!after) return true
  }
  return false
}

async function waitForComposeReady(timeoutMs = 12_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (getComposeInput()) return true
    await sleep(250)
  }
  return false
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function batchNavKey(index: number, digits: string): string {
  return `mv_batch_nav:${index}:${digits}`
}

function batchNavAttemptKey(index: number, digits: string): string {
  return `mv_batch_nav_attempt:${index}:${digits}`
}

function currentPhoneFromUrl(): string {
  try {
    const url = new URL(window.location.href)
    const phone = url.searchParams.get('phone') ?? ''
    return phone.replace(/\D/g, '')
  } catch {
    return ''
  }
}

function samePhoneTarget(expectedDigits: string): boolean {
  const current = currentPhoneFromUrl()
  if (!current || !expectedDigits) return false
  return current === expectedDigits
    || current.endsWith(expectedDigits)
    || expectedDigits.endsWith(current)
}

function buildOfferText(
  contactName: string,
  campaign: Campaign | null,
  hotel: Hotel | null,
): string {
  const firstName = (contactName || 'cliente').split(' ')[0]
  let msg = `Oi ${firstName}!\n\n`

  if (campaign) {
    msg += `${campaign.offerText || campaign.name}\n`
    if (campaign.dateRange) msg += `${campaign.dateRange}\n`
  }

  if (hotel) {
    msg += `\n*${hotel.name}* - ${hotel.destination}`
    if (hotel.stars) msg += ` (${Array(hotel.stars).fill('*').join('')})`
    msg += '\n'
    if (hotel.description) msg += `${hotel.description}\n`
    if (hotel.highlights?.length) {
      msg += hotel.highlights.map((h: string) => `- ${h}`).join('\n') + '\n'
    }
    if (hotel.priceFrom) {
      msg += `\nA partir de R$ ${hotel.priceFrom.toLocaleString('pt-BR')}\n`
    }
  }

  if (campaign?.ctaText) msg += `\n${campaign.ctaText}`
  return msg
}

function buildOfferImageOptions(): OfferImageOption[] {
  return []
}

// â”€â”€ Cores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const C = {
  teal:      '#075e54',
  tealLight: '#128c7e',
  tealBg:    '#e8f5e9',
  gray:      '#64748b',
  border:    '#e2e8f0',
  white:     '#ffffff',
  text:      '#0f172a',
  textSm:    '#475569',
  danger:    '#dc2626',
  green:     '#16a34a',
  bgLight:   '#f8fafc',
  bgAlt:     '#f0fdf4',
  borderGreen: '#bbf7d0',
}

// â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function SalesShell({ currentChat, onClose }: Props) {
  // NavegaÃ§Ã£o
  const [tab, setTab] = useState<ActiveTab>('disparar')

  // Dados globais
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState('')
  const loadedRef = useRef(false)

  // Disparar
  const [step, setStep] = useState<DisparStep>('oferta')
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [selectedImageKey, setSelectedImageKey] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [localOfferImageDataUrl, setLocalOfferImageDataUrl] = useState('')
  const [localOfferImageName, setLocalOfferImageName] = useState('')
  const [localOfferImageError, setLocalOfferImageError] = useState('')
  const [imageActionMsg, setImageActionMsg] = useState('')
  const [contacts, setContacts] = useState<ContactListItem[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [sendQueue, setSendQueue] = useState<ContactListItem[]>([])
  const [customMessage, setCustomMessage] = useState('')
  const [sendIndex, setSendIndex] = useState(0)
  const [sendDone, setSendDone] = useState(0)
  const [sendSkipped, setSendSkipped] = useState(0)
  const [sendError, setSendError] = useState('')
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResult, setBatchResult] = useState('')
  const [batchDebug, setBatchDebug] = useState('')
  const [batchContacts, setBatchContacts] = useState<BatchContact[]>([])
  const batchTickRef = useRef(false)

  const [createContactStatus, setCreateContactStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [createContactMsg, setCreateContactMsg] = useState('')
  const [pendingSends, setPendingSends] = useState<PendingSend[]>([])
  const [pendingSendsLoading, setPendingSendsLoading] = useState(false)
  const [pendingSendsError, setPendingSendsError] = useState('')
  const [markRepliedError, setMarkRepliedError] = useState('')
  const [funnelPeriodDays, setFunnelPeriodDays] = useState(7)
  const [funnelOverview, setFunnelOverview] = useState<MetricsOverview | null>(null)
  const [funnelSends, setFunnelSends] = useState<MetricsSends | null>(null)
  const [campaignSendsMap, setCampaignSendsMap] = useState<Record<string, MetricsSends>>({})
  const [funnelLoading, setFunnelLoading] = useState(false)
  const [funnelError, setFunnelError] = useState('')

  // Chat atual
  const activeChat = currentChat?.type === 'CHAT' ? currentChat.chat : null
  const chatName = activeChat?.name ?? null
  const chatPhone = activeChat?.phoneE164 ?? null

  useEffect(() => {
    setCreateContactStatus('idle')
    setCreateContactMsg('')
  }, [chatName, chatPhone])

  // â”€â”€ Injetar keyframes no shadow DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const host = document.getElementById('mv-root')
    if (host?.shadowRoot) {
      if (!host.shadowRoot.querySelector('style[data-mv-anim]')) {
        const s = document.createElement('style')
        s.setAttribute('data-mv-anim', '1')
        s.textContent = '@keyframes mv-spin { to { transform: rotate(360deg); } }'
        host.shadowRoot.appendChild(s)
      }
    }
  }, [])

  const refreshOffersCatalog = useCallback(() => {
    safeSendMessage<CampaignsResult>({ type: 'GET_CAMPAIGNS' }, res => {
      setCampaigns(Array.isArray(res?.campaigns) ? res.campaigns : [])
    })
    safeSendMessage<HotelsResult>({ type: 'GET_HOTELS' }, res => {
      setHotels(Array.isArray(res?.hotels) ? res.hotels : [])
    })
  }, [])

  // â”€â”€ Buscar ofertas pendentes (fila de respostas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchPendingSends = useCallback(() => {
    setPendingSendsLoading(true)
    setPendingSendsError('')
    safeSendMessage<PendingSendsResult & { ok?: boolean; error?: string }>({ type: 'GET_PENDING_SENDS', days: funnelPeriodDays }, (res, err) => {
      if (err || res?.ok === false) {
        setPendingSendsError(err ?? res?.error ?? 'Nao foi possivel carregar a fila de ofertas pendentes.')
        setPendingSendsLoading(false)
        return
      }
      setPendingSends(Array.isArray(res?.sends) ? res!.sends : [])
      setPendingSendsLoading(false)
    })
  }, [funnelPeriodDays])

  const handleMarkReplied = useCallback((sendId: string) => {
    setMarkRepliedError('')
    safeSendMessage<MarkRepliedResult>({ type: 'MARK_REPLIED', sendId }, (res, err) => {
      if (res?.ok) {
        setPendingSends(prev => prev.filter(s => s.id !== sendId))
        return
      }
      setMarkRepliedError(err ?? res?.error ?? 'Nao foi possivel marcar o contato como respondido.')
    })
  }, [])

  const fetchFunnelData = useCallback(() => {
    setFunnelLoading(true)
    setFunnelError('')

    const activeCampaigns = campaigns.filter(c => c.isActive)
    let pending = 2 + activeCampaigns.length
    const nextCampaignMap: Record<string, MetricsSends> = {}

    const done = () => {
      pending -= 1
      if (pending <= 0) {
        setCampaignSendsMap(nextCampaignMap)
        setFunnelLoading(false)
      }
    }

    safeSendMessage<MetricsOverviewResult>({ type: 'GET_METRICS_OVERVIEW' }, (res, err) => {
      if (err) setFunnelError('Nao foi possivel carregar o funil.')
      else setFunnelOverview(res?.overview ?? null)
      done()
    })

    safeSendMessage<MetricsSendsResult>({ type: 'GET_METRICS_SENDS', days: funnelPeriodDays }, (res, err) => {
      if (err || res?.ok === false) setFunnelError('Nao foi possivel carregar as metricas de envio.')
      else setFunnelSends(res?.sendsMetrics ?? null)
      done()
    })

    if (activeCampaigns.length === 0) {
      setCampaignSendsMap({})
    }

    activeCampaigns.forEach(campaign => {
      safeSendMessage<MetricsSendsResult>(
        { type: 'GET_METRICS_SENDS', campaignId: campaign.id, days: funnelPeriodDays },
        (res, err) => {
          if (!err && res?.ok !== false && res?.sendsMetrics) {
            nextCampaignMap[campaign.id] = res.sendsMetrics
          }
          done()
        },
      )
    })
  }, [campaigns, funnelPeriodDays])

  const openWhatsAppChat = useCallback((phoneE164: string) => {
    const digits = phoneE164.replace(/\D/g, '')
    if (!digits) return
    window.location.href = `https://web.whatsapp.com/send?phone=${digits}`
  }, [])

  // â”€â”€ Carregar dados iniciais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    // Tab persistida
    chrome.storage.local.get('mv_active_tab', d => {
      const saved = d['mv_active_tab']
      if (saved === 'disparar' || saved === 'responder' || saved === 'pos') setTab(saved)
    })

    let pending = 3
    function done() {
      pending--
      if (pending === 0) setLoadingData(false)
    }

    safeSendMessage<PingResult>({ type: 'PING' }, (res, err) => {
      const ok = Boolean(res?.authenticated)
      setAuthOk(ok)
      setAuthError(err || res?.error || '')
      done()
    })

    safeSendMessage<CampaignsResult>({ type: 'GET_CAMPAIGNS' }, res => {
      setCampaigns(Array.isArray(res?.campaigns) ? res!.campaigns : [])
      done()
    })

    safeSendMessage<HotelsResult>({ type: 'GET_HOTELS' }, res => {
      setHotels(Array.isArray(res?.hotels) ? res!.hotels : [])
      done()
    })

    // Carregar fila de ofertas pendentes
    fetchPendingSends()
  }, [fetchPendingSends])

  // Refresh automÃ¡tico da fila de pendentes a cada 30 segundos
  useEffect(() => {
    const interval = window.setInterval(fetchPendingSends, 30_000)
    return () => window.clearInterval(interval)
  }, [fetchPendingSends])

  useEffect(() => {
    if (tab !== 'responder') return
    fetchFunnelData()
    const interval = window.setInterval(fetchFunnelData, 60_000)
    return () => window.clearInterval(interval)
  }, [fetchFunnelData, tab])

  useEffect(() => {
    // Fluxo atual de lote e via backend; limpa estado legado de automacao web.
    chrome.storage.local.remove(BATCH_STATE_KEY)
  }, [])

  useEffect(() => {
    if (!batchRunning || batchContacts.length === 0) {
      chrome.storage.local.remove(BATCH_STATE_KEY)
      return
    }
    const payload: BatchState = {
      running: true,
      contacts: batchContacts,
      index: sendIndex,
      sent: sendDone,
      failed: Math.max(0, sendIndex - sendDone),
    }
    chrome.storage.local.set({ [BATCH_STATE_KEY]: payload })
  }, [batchContacts, batchRunning, sendDone, sendIndex])

  // â”€â”€ Trocar aba â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const switchTab = useCallback((t: ActiveTab) => {
    setTab(t)
    chrome.storage.local.set({ mv_active_tab: t })
    if (t !== 'disparar') {
      setStep('oferta')
      setSelectedContactIds(new Set())
      setSendQueue([])
      setBatchRunning(false)
      setBatchContacts([])
      setBatchDebug('')
      setSendIndex(0); setSendDone(0); setSendSkipped(0)
      chrome.storage.local.remove(BATCH_STATE_KEY)
    }
  }, [])

  // â”€â”€ Carregar contatos (debounced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadContacts = useCallback(() => {
    setContactsLoading(true)
    safeSendMessage<ContactResult>(
      { type: 'GET_CONTACTS', limit: 60, search: contactSearch || undefined },
      res => {
        setContacts(Array.isArray(res?.contacts) ? res!.contacts : [])
        setContactsLoading(false)
      },
    )
  }, [contactSearch])

  useEffect(() => {
    if (tab === 'disparar' && step === 'publico') {
      const t = setTimeout(loadContacts, 350)
      return () => clearTimeout(t)
    }
  }, [tab, step, contactSearch, loadContacts])

  useEffect(() => {
    if (tab === 'disparar' && step === 'oferta') {
      refreshOffersCatalog()
    }
  }, [tab, step, refreshOffersCatalog])

  // â”€â”€ Dados derivados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const campaign = campaigns.find(c => c.id === selectedCampaignId) ?? null
  const hotel    = hotels.find(h => h.id === selectedHotelId) ?? null
  const imageOptions = useMemo(() => buildOfferImageOptions(), [])

  // Reset customMessage quando oferta mudar
  useEffect(() => { setCustomMessage('') }, [selectedCampaignId, selectedHotelId])

  const buildPreview = useCallback((contactName: string) => {
    return customMessage || buildOfferText(contactName, campaign, hotel)
  }, [customMessage, campaign, hotel])

  const selectedContacts = contacts.filter(c => selectedContactIds.has(c.id))
  const activeSendContacts = sendQueue.length > 0 ? sendQueue : selectedContacts

  // â”€â”€ Envio assistido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleGoToSend() {
    if (selectedContacts.length === 0) {
      setSendError('Selecione pelo menos 1 contato antes de iniciar o envio.')
      return
    }
    setSendQueue(selectedContacts)
    setSendError('')
    setBatchResult('')
    setBatchDebug('')
    setSendIndex(0); setSendDone(0); setSendSkipped(0)
    setStep('envio')
  }

  function handlePaste() {
    const contact = activeSendContacts[sendIndex]
    if (!contact) return
    const ok = fillCompose(buildPreview(contact.name))
    if (!ok) {
      setSendError('Nao consegui colar. Abra o chat do contato atual e tente novamente.')
      return
    }
    setSendError('')
    safeSendMessage({
      type: 'LOG_ASSISTED_SEND',
      contactId: contact.id,
      campaignId: selectedCampaignId || undefined,
      hotelId: selectedHotelId || undefined,
    })
    setSendDone(d => d + 1)
    setSendIndex(i => i + 1)
  }

  function handleSkip() {
    setSendError('')
    setBatchResult('')
    setSendSkipped(s => s + 1)
    setSendIndex(i => i + 1)
  }

  async function handleBatchSend() {
    if (batchRunning) return
    if (activeSendContacts.length === 0) {
      setSendError('Selecione pelo menos 1 contato para disparar o lote.')
      setBatchDebug(`Sem lote ativo. selected=${selectedContacts.length} queue=${sendQueue.length} sendIndex=${sendIndex}`)
      return
    }

    const startIndex = sendIndex >= activeSendContacts.length ? 0 : sendIndex
    if (startIndex === 0 && sendIndex !== 0) {
      setSendDone(0)
      setSendSkipped(0)
      setSendIndex(0)
    }

    const selected = activeSendContacts.slice(startIndex, startIndex + 10)
    if (selected.length === 0) {
      setSendError('Nao encontrei contatos validos para este lote.')
      setBatchDebug(`Slice vazio. active=${activeSendContacts.length} startIndex=${startIndex} sendIndex=${sendIndex}`)
      return
    }
    setBatchRunning(true)
    setSendError('')
    setBatchResult('Iniciando disparo do lote...')
    setBatchDebug(`Preparando lote: active=${activeSendContacts.length} selected=${selected.length} startIndex=${startIndex} image=${localOfferImageDataUrl ? 'local' : 'none'}`)

    const items = selected.map(contact => ({
      contactId: contact.id,
      phoneE164: String(contact.phoneE164 || ''),
      text: buildPreview(contact.name),
    }))

    const sendChunk = (chunkItems: Array<{ contactId: string; phoneE164: string; text: string }>) => new Promise<{
      res?: {
        ok?: boolean
        sent?: number
        failed?: number
        error?: string
        results?: Array<{ contactId: string; success: boolean; error?: string }>
        ready?: boolean
        qrDataUrl?: string | null
      }
      runtimeError?: string
      timedOut?: boolean
    }>(resolve => {
      let done = false
      const timer = window.setTimeout(() => {
        if (done) return
        done = true
        resolve({ timedOut: true })
      }, BATCH_RESPONSE_TIMEOUT_MS)

      safeSendMessage<{
        ok?: boolean
        sent?: number
        failed?: number
        error?: string
        results?: Array<{ contactId: string; success: boolean; error?: string }>
        ready?: boolean
        qrDataUrl?: string | null
      }>(
        {
          type: 'BATCH_SEND_TEXT',
          campaignId: selectedCampaignId || undefined,
          hotelId: selectedHotelId || undefined,
          imageUrl: undefined,
          imageDataUrl: localOfferImageDataUrl || undefined,
          items: chunkItems,
        },
        (res, runtimeError) => {
          if (done) return
          done = true
          window.clearTimeout(timer)
          resolve({ res, runtimeError })
        },
      )
    })

    setBatchResult(`Disparando 1/${items.length}...`)
    const response = await sendChunk(items)

    let totalSent = 0
    let totalFailed = items.length
    const errorMessages: string[] = []

    if (response.timedOut) {
      errorMessages.push('Timeout no envio do lote')
      setBatchDebug(prev => `${prev}\nResposta: timeout apos ${BATCH_RESPONSE_TIMEOUT_MS}ms`)
    } else {
      const res = response.res
      const runtimeError = response.runtimeError
      setBatchDebug(prev => `${prev}\nResposta: ${JSON.stringify({
        runtimeError: runtimeError || null,
        ok: res?.ok ?? null,
        sent: res?.sent ?? null,
        failed: res?.failed ?? null,
        error: res?.error ?? null,
        ready: res?.ready ?? null,
        results: Array.isArray(res?.results) ? res?.results.length : null,
      })}`)
      if (runtimeError || !res?.ok) {
        const errText = String(res?.error ?? '')
        if (
          errText.includes('WA_WEB_NOT_READY')
          || errText.includes('WA_WEB_START_FAILED')
          || errText.includes('spawn EPERM')
          || res?.ready === false
        ) {
          setSendError('WhatsApp-web.js nao conectado. Inicie a sessao no backend e escaneie o QR.')
          setBatchDebug(prev => `${prev}\nDiagnostico: backend retornou falha de sessao WA.`)
          setBatchRunning(false)
          return
        }
        errorMessages.push(runtimeError ?? res?.error ?? 'Falha no envio do lote')
      } else {
        totalSent = Number(res.sent ?? 0)
        totalFailed = Number(res.failed ?? 0)
        const firstItemError = (res.results ?? []).find(r => r.success === false && r.error)?.error
        if (firstItemError) errorMessages.push(firstItemError)
        if (totalFailed > 0 && !firstItemError) {
          errorMessages.push(`${totalFailed} contato(s) falharam no lote.`)
        }
      }
    }

    setBatchRunning(false)

    if (errorMessages.length > 0) setSendError(errorMessages[0])
    else setSendError('')

    setSendDone(d => d + totalSent)
    if (totalSent > 0) {
      setSendIndex(startIndex + totalSent)
    } else {
      setSendIndex(startIndex)
    }
    setBatchResult(`Lote: ${totalSent} enviado(s), ${totalFailed} falha(s).`)
    if (totalSent === 0) {
      setSendError(prev => prev || 'O lote nao enviou nenhuma mensagem. Verifique a resposta do backend antes de tentar novamente.')
      setBatchDebug(prev => `${prev}\nDiagnostico: nenhum contato foi enviado; a etapa nao vai mais avancar automaticamente.`)
    }
  }
  useEffect(() => {
    if (!batchRunning) return
    if (batchTickRef.current) return
    if (batchContacts.length === 0) return

    if (sendIndex >= batchContacts.length) {
      const failed = Math.max(0, batchContacts.length - sendDone)
      setBatchResult(`Lote finalizado: ${sendDone} enviado(s), ${failed} falha(s).`)
      setBatchRunning(false)
      setBatchContacts([])
      return
    }

    let cancelled = false
    const run = async () => {
      batchTickRef.current = true
      try {
        const contact = batchContacts[sendIndex]
        if (!contact) return

        const digits = String(contact.phoneE164 || '').replace(/\D/g, '')
        if (!digits) {
          if (!cancelled) setSendIndex(i => i + 1)
          return
        }

        const encodedText = encodeURIComponent(contact.text)
        const targetUrl = `https://web.whatsapp.com/send?phone=${digits}&text=${encodedText}&app_absent=0`
        const navKey = batchNavKey(sendIndex, digits)
        const navAttemptKey = batchNavAttemptKey(sendIndex, digits)
        const alreadyNavigated = sessionStorage.getItem(navKey) === '1'
        const attempts = Number(sessionStorage.getItem(navAttemptKey) || '0')
        if (attempts >= 3) {
          sessionStorage.removeItem(navKey)
          sessionStorage.removeItem(navAttemptKey)
          setSendError('Um contato falhou apos 3 tentativas. Seguindo para o proximo.')
          if (!cancelled) setSendIndex(i => i + 1)
          return
        }
        if (!alreadyNavigated && !window.location.href.includes(`phone=${digits}`)) {
          if (hasComposeDraft()) {
            const cleared = clearComposeDraft()
            if (!cleared) {
              setSendError('Existe mensagem pendente no chat atual e nao consegui limpar. Lote pausado.')
              setBatchRunning(false)
              setBatchResult(`Lote pausado no contato ${sendIndex + 1}/${batchContacts.length}.`)
              return
            }
          }
          sessionStorage.setItem(navKey, '1')
          sessionStorage.setItem(navAttemptKey, String(attempts + 1))
          window.location.href = targetUrl
          return
        }

        const ready = await waitForComposeReady(12_000)
        if (!ready || cancelled) {
          if (!cancelled) setSendIndex(i => i + 1)
          return
        }

        if (!samePhoneTarget(digits)) {
          setSendError('Seguranca: chat aberto nao confere com o contato alvo. Lote pausado.')
          setBatchRunning(false)
          setBatchResult(`Parado no contato ${sendIndex + 1}/${batchContacts.length}. Abra o chat correto e retome.`)
          return
        }

        fillCompose(contact.text)
        await sleep(200)
        const composeHasText = Boolean(getComposeText())
        if (!composeHasText) {
          setSendError('Nao consegui preparar a mensagem neste contato. O lote foi pausado.')
          setBatchRunning(false)
          setBatchResult(`Parado no contato ${sendIndex + 1}/${batchContacts.length}.`)
          return
        }
        await sleep(350)
        const sent = await trySendCurrentMessage(4)
        if (sent && !cancelled) {
          safeSendMessage({
            type: 'LOG_ASSISTED_SEND',
            contactId: contact.id,
            campaignId: selectedCampaignId || undefined,
            hotelId: selectedHotelId || undefined,
          })
          sessionStorage.removeItem(navKey)
          sessionStorage.removeItem(navAttemptKey)
          setSendDone(d => d + 1)
        }
        if (!sent && !cancelled) {
          sessionStorage.removeItem(navKey)
          setSendError('Nao confirmou envio deste contato. O lote foi pausado para evitar pular mensagem.')
          setBatchRunning(false)
          setBatchResult(`Parado no contato ${sendIndex + 1}/${batchContacts.length}. Confirme o envio e retome.`)
          return
        }
        if (!cancelled) setSendIndex(i => i + 1)
      } finally {
        batchTickRef.current = false
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [batchContacts, batchRunning, selectedCampaignId, selectedHotelId, sendDone, sendIndex])

  function handleReset() {
    setStep('oferta')
    setSelectedContactIds(new Set())
    setSendQueue([])
    setCustomMessage('')
    setSendError('')
    setBatchResult('')
    setBatchDebug('')
    setBatchRunning(false)
    setBatchContacts([])
    setLocalOfferImageDataUrl('')
    setLocalOfferImageName('')
    setLocalOfferImageError('')
    setSendIndex(0); setSendDone(0); setSendSkipped(0)
    chrome.storage.local.remove(BATCH_STATE_KEY)
  }

  const handlePickLocalOfferImage = useCallback((file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocalOfferImageError('Selecione um arquivo de imagem (png/jpg/webp).')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setLocalOfferImageError('Imagem muito grande. Use ate 4MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (!dataUrl.startsWith('data:image/')) {
        setLocalOfferImageError('Nao consegui ler a imagem selecionada.')
        return
      }
      setLocalOfferImageDataUrl(dataUrl)
      setLocalOfferImageName(file.name)
      setLocalOfferImageError('')
    }
    reader.onerror = () => {
      setLocalOfferImageError('Falha ao carregar a imagem local.')
    }
    reader.readAsDataURL(file)
  }, [])

  // â”€â”€ SugestÃµes de resposta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCreateContact = useCallback(() => {
    if (!chatName || !chatPhone) {
      setCreateContactStatus('error')
      setCreateContactMsg('Nao consegui capturar o telefone deste chat ainda.')
      return
    }
    setCreateContactStatus('loading')
    setCreateContactMsg('')
    safeSendMessage<{ ok?: boolean; error?: string }>(
      {
        type: 'CREATE_CONTACT',
        name: chatName,
        phoneE164: chatPhone,
      },
      (res, err) => {
        if (err || !res?.ok) {
          setCreateContactStatus('error')
          setCreateContactMsg(err ?? res?.error ?? 'Falha ao cadastrar contato')
          return
        }
        setCreateContactStatus('ok')
        setCreateContactMsg('Contato cadastrado na base.')
      },
    )
  }, [chatName, chatPhone])
  // Templates pÃ³s-venda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const name = chatName || 'cliente'
  const posTemplates = [
    {
      id: 'feedback',
      icon: '*',
      label: 'Feedback da viagem',
      text: `Oi ${name}!\n\nEspero que a viagem tenha sido incrivel!\nComo foi a experiencia? Qualquer feedback e muito bem-vindo.`,
    },
    {
      id: 'indicacao',
      icon: '+',
      label: 'Pedir indicacao',
      text: `Oi ${name}!\n\nFiquei muito feliz em cuidar da sua viagem!\nSe conhecer alguem pensando em viajar, pode me indicar? Cuido bem de quem voce indicar.`,
    },
    {
      id: 'proxima',
      icon: '>',
      label: 'Proxima viagem',
      text: `Oi ${name}!\n\nJa esta pensando na proxima aventura?\nTenho novos pacotes incriveis! Me diz qual destino esta no seu coracao e faco uma cotacao especial.`,
    },
  ]

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={S.shell}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.logo}>MV</span>
        <div style={S.tabs}>
          {(['disparar', 'responder', 'pos'] as ActiveTab[]).map(t => (
            <button
              key={t}
              style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }}
              onClick={() => switchTab(t)}
            >
                  {t === 'disparar' ? 'Disparar' : t === 'responder' ? 'Funil' : 'Pos'}
            </button>
          ))}
        </div>
        <button style={S.closeBtn} onClick={onClose} title="Fechar">X</button>
      </div>

      {/* Body */}
      <div style={S.body}>
        {loadingData ? (
          <div style={S.center}>
            <div style={S.spinner} />
            <p style={S.hint}>Carregando dados...</p>
          </div>
        ) : tab === 'disparar' ? (
          authOk === false ? (
            <div style={S.center}>
              <div style={{ maxWidth: 300, textAlign: 'center' }}>
                <p style={{ ...S.hint, marginBottom: 8 }}>
                  Extensao sem autenticacao no backend.
                </p>
                <p style={{ ...S.hint, fontSize: 11, marginBottom: 12 }}>
                  Abra o popup da extensao e faca login com email/senha.
                </p>
                {authError && (
                  <p style={{ fontSize: 11, color: C.danger, margin: 0 }}>
                    {authError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <DisparView
              step={step}
              campaigns={campaigns}
              hotels={hotels}
              selectedCampaignId={selectedCampaignId}
              setSelectedCampaignId={setSelectedCampaignId}
              selectedHotelId={selectedHotelId}
              setSelectedHotelId={setSelectedHotelId}
              imageOptions={imageOptions}
              selectedImageKey={selectedImageKey}
              setSelectedImageKey={setSelectedImageKey}
              selectedImageUrl={selectedImageUrl}
              setSelectedImageUrl={setSelectedImageUrl}
              imageActionMsg={imageActionMsg}
              setImageActionMsg={setImageActionMsg}
              contacts={contacts}
              contactSearch={contactSearch}
              setContactSearch={setContactSearch}
              contactsLoading={contactsLoading}
              selectedContactIds={selectedContactIds}
              setSelectedContactIds={setSelectedContactIds}
              customMessage={customMessage}
              setCustomMessage={setCustomMessage}
              campaign={campaign}
              hotel={hotel}
              buildPreview={buildPreview}
              selectedContacts={selectedContacts}
              sendContacts={activeSendContacts}
              sendIndex={sendIndex}
              sendDone={sendDone}
              sendSkipped={sendSkipped}
              sendError={sendError}
              batchRunning={batchRunning}
              batchResult={batchResult}
              batchDebug={batchDebug}
              canCreateContact={Boolean(chatName && chatPhone)}
              createContactStatus={createContactStatus}
              createContactMsg={createContactMsg}
              localOfferImageName={localOfferImageName}
              localOfferImageDataUrl={localOfferImageDataUrl}
              localOfferImageError={localOfferImageError}
              onRefreshOffers={refreshOffersCatalog}
              onPickLocalOfferImage={handlePickLocalOfferImage}
              onClearLocalOfferImage={() => {
                setLocalOfferImageDataUrl('')
                setLocalOfferImageName('')
                setLocalOfferImageError('')
              }}
              onOfertaNext={() => setStep('publico')}
              onPublicoBack={() => setStep('oferta')}
              onPublicoNext={() => setStep('mensagem')}
              onMensagemBack={() => setStep('publico')}
              onMensagemNext={handleGoToSend}
              onPaste={handlePaste}
              onBatchSend={handleBatchSend}
              onSkip={handleSkip}
              onReset={handleReset}
              onCreateContact={handleCreateContact}
            />
          )
        ) : tab === 'responder' ? (
          <FunilView
            campaigns={campaigns}
            pendingSends={pendingSends}
            pendingSendsLoading={pendingSendsLoading}
            pendingSendsError={pendingSendsError}
            markRepliedError={markRepliedError}
            funnelOverview={funnelOverview}
            funnelSends={funnelSends}
            campaignSendsMap={campaignSendsMap}
            funnelLoading={funnelLoading}
            funnelError={funnelError}
            funnelPeriodDays={funnelPeriodDays}
            setFunnelPeriodDays={setFunnelPeriodDays}
            onRefresh={fetchFunnelData}
            onRefreshPending={fetchPendingSends}
            onOpenChat={openWhatsAppChat}
            onMarkReplied={handleMarkReplied}
          />
        ) : (
          <PosView templates={posTemplates} chatName={chatName} />
        )}
      </div>
    </div>
  )
}

// â•â• DisparView â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface DisparProps {
  step: DisparStep
  campaigns: Campaign[]
  hotels: Hotel[]
  selectedCampaignId: string
  setSelectedCampaignId: (id: string) => void
  selectedHotelId: string
  setSelectedHotelId: (id: string) => void
  imageOptions: OfferImageOption[]
  selectedImageKey: string
  setSelectedImageKey: (key: string) => void
  selectedImageUrl: string
  setSelectedImageUrl: (url: string) => void
  imageActionMsg: string
  setImageActionMsg: (message: string) => void
  contacts: ContactListItem[]
  contactSearch: string
  setContactSearch: (s: string) => void
  contactsLoading: boolean
  selectedContactIds: Set<string>
  setSelectedContactIds: React.Dispatch<React.SetStateAction<Set<string>>>
  customMessage: string
  setCustomMessage: (m: string) => void
  campaign: Campaign | null
  hotel: Hotel | null
  buildPreview: (name: string) => string
  selectedContacts: ContactListItem[]
  sendContacts: ContactListItem[]
  sendIndex: number
  sendDone: number
  sendSkipped: number
  sendError: string
  batchRunning: boolean
  batchResult: string
  batchDebug: string
  canCreateContact: boolean
  createContactStatus: 'idle' | 'loading' | 'ok' | 'error'
  createContactMsg: string
  localOfferImageName: string
  localOfferImageDataUrl: string
  localOfferImageError: string
  onRefreshOffers: () => void
  onPickLocalOfferImage: (file: File | null) => void
  onClearLocalOfferImage: () => void
  onOfertaNext: () => void
  onPublicoBack: () => void
  onPublicoNext: () => void
  onMensagemBack: () => void
  onMensagemNext: () => void
  onPaste: () => void
  onBatchSend: () => void
  onSkip: () => void
  onReset: () => void
  onCreateContact: () => void
}

const STEPS: DisparStep[] = ['oferta', 'publico', 'mensagem', 'envio']
const STEP_LABELS = ['Oferta', 'Publico', 'Texto', 'Envio']

function DisparView(p: DisparProps) {
  const stepIdx = STEPS.indexOf(p.step)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Step indicator */}
      <div style={S.stepBar}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{
                ...S.stepDot,
                background: i <= stepIdx ? C.teal : C.border,
                color:      i <= stepIdx ? C.white : C.gray,
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 8, color: i === stepIdx ? C.teal : C.gray, fontWeight: i === stepIdx ? 700 : 400 }}>
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < 3 && <span style={{ color: C.border, fontSize: 14, marginBottom: 10 }}>{'>'}</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 16px' }}>
        <div style={{ marginBottom: 10 }}>
          <button
            style={{ ...S.btnPrimary, background: '#0f766e', opacity: p.canCreateContact && p.createContactStatus !== 'loading' ? 1 : 0.55 }}
            disabled={!p.canCreateContact || p.createContactStatus === 'loading'}
            onClick={p.onCreateContact}
          >
            {p.createContactStatus === 'loading' ? 'Cadastrando contato...' : 'Adicionar contato na base'}
          </button>
          {p.createContactMsg && (
            <p style={{ fontSize: 11, color: p.createContactStatus === 'ok' ? '#166534' : C.danger, margin: '6px 0 0' }}>
              {p.createContactMsg}
            </p>
          )}
        </div>
        {p.step === 'oferta'   && <StepOferta   {...p} />}
        {p.step === 'publico'  && <StepPublico  {...p} />}
        {p.step === 'mensagem' && <StepMensagem {...p} />}
        {p.step === 'envio'    && <StepEnvio    {...p} />}
      </div>
    </div>
  )
}

// â”€â”€ Step 1: Oferta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepOferta(p: DisparProps) {
  const canNext = !!(p.selectedCampaignId || p.selectedHotelId)
  const orderedCampaigns = useMemo(
    () => [...p.campaigns].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [p.campaigns],
  )

  return (
    <div style={S.stepContent}>
      <p style={S.stepTitle}>Monte a oferta</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button style={{ ...S.btnGhost, height: 30, fontSize: 11 }} onClick={p.onRefreshOffers}>
          Sincronizar com Dash
        </button>
      </div>

      <label style={S.label}>Campanha</label>
      <select
        style={S.select}
        value={p.selectedCampaignId}
        onChange={e => p.setSelectedCampaignId(e.target.value)}
      >
        <option value="">- Sem campanha -</option>
        {orderedCampaigns.map(c => (
          <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (inativa)'}</option>
        ))}
      </select>

      <label style={S.label}>Hotel / Produto</label>
      <select
        style={S.select}
        value={p.selectedHotelId}
        onChange={e => p.setSelectedHotelId(e.target.value)}
      >
        <option value="">- Sem hotel -</option>
        {p.hotels.filter(h => h.isActive).map(h => (
          <option key={h.id} value={h.id}>
            {h.name} - {h.destination}
            {h.priceFrom ? ` - R$ ${h.priceFrom.toLocaleString('pt-BR')}` : ''}
          </option>
        ))}
      </select>

      <label style={{ ...S.label, display: 'none' }}>Imagem da oferta</label>
      <select
        style={{ ...S.select, display: 'none' }}
        value={p.selectedImageKey}
        onChange={e => {
          const nextKey = e.target.value
          const selected = p.imageOptions.find(opt => opt.key === nextKey)
          p.setSelectedImageKey(nextKey)
          p.setSelectedImageUrl(selected?.url ?? '')
          p.setImageActionMsg('')
        }}
      >
        {p.imageOptions.length === 0 && <option value="">- Sem imagem -</option>}
        {p.imageOptions.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>

      <input
        style={{ ...S.select, marginTop: 6, display: 'none' }}
        value={p.selectedImageUrl}
        onChange={e => {
          p.setSelectedImageKey('')
          p.setSelectedImageUrl(e.target.value)
          p.setImageActionMsg('')
        }}
        placeholder="URL da imagem (opcional)"
      />

      {p.hotel && (
        <div style={S.previewCard}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.teal }}>
            {p.hotel.name}
            {p.hotel.stars ? <span style={{ color: '#f59e0b' }}> {Array(p.hotel.stars).fill('*').join('')}</span> : null}
          </div>
          <div style={{ fontSize: 11, color: C.gray }}>{p.hotel.destination}</div>
          {(p.hotel.highlights ?? []).length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(p.hotel.highlights ?? []).slice(0, 4).map((h: string) => (
                <span key={h} style={S.chip}>{h}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {false && p.selectedImageUrl && (
        <div style={{ ...S.previewCard, display: 'flex', gap: 8, alignItems: 'center' }}>
          <img
            src={p.selectedImageUrl}
            alt="Imagem da oferta"
            style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.border}` }}
          />
          <button
            style={{ ...S.btnGhost, height: 30, padding: '0 10px', fontSize: 11 }}
            onClick={async () => {
              try {
                const resp = await fetch(p.selectedImageUrl)
                const blob = await resp.blob()
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
                p.setImageActionMsg('Imagem copiada. Cole no WhatsApp com Ctrl+V.')
              } catch {
                p.setImageActionMsg('Nao foi possivel copiar a imagem selecionada.')
              }
            }}
          >
            Copiar imagem
          </button>
        </div>
      )}
      {false && p.imageActionMsg && (
        <p style={{ fontSize: 11, color: C.textSm, marginTop: 6 }}>{p.imageActionMsg}</p>
      )}

      {!canNext && (
        <p style={{ fontSize: 10, color: C.gray, margin: '4px 0 0' }}>
          Selecione ao menos uma campanha ou hotel.
        </p>
      )}

      <button
        style={{ ...S.btnPrimary, marginTop: 16, opacity: canNext ? 1 : 0.45 }}
        disabled={!canNext}
        onClick={p.onOfertaNext}
      >
        Proximo: Escolher publico {'>'}
      </button>
    </div>
  )
}

// â”€â”€ Step 2: PÃºblico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepPublico(p: DisparProps) {
  function toggleOne(id: string) {
    p.setSelectedContactIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (p.selectedContactIds.size === p.contacts.length && p.contacts.length > 0) {
      p.setSelectedContactIds(new Set())
    } else {
      p.setSelectedContactIds(new Set(p.contacts.map(c => c.id)))
    }
  }

  const allSelected = p.contacts.length > 0 && p.selectedContactIds.size === p.contacts.length

  return (
    <div style={S.stepContent}>
      <p style={S.stepTitle}>Selecione os contatos</p>

      <input
        style={S.input}
        placeholder="Buscar por nome ou telefone..."
        value={p.contactSearch}
        onChange={e => p.setContactSearch(e.target.value)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.gray }}>
          {p.selectedContactIds.size} selecionado(s)
        </span>
        <button style={S.btnLink} onClick={toggleAll}>
          {allSelected ? 'Desmarcar todos' : 'Selec. todos'}
        </button>
      </div>

      {p.contactsLoading ? (
        <div style={{ ...S.center, minHeight: 80 }}>
          <div style={S.spinnerSm} />
        </div>
      ) : p.contacts.length === 0 ? (
        <p style={S.hint}>Nenhum contato encontrado.</p>
      ) : (
        <div style={S.contactList}>
          {p.contacts.map(c => (
            <label key={c.id} style={S.contactRow}>
              <input
                type="checkbox"
                checked={p.selectedContactIds.has(c.id)}
                onChange={() => toggleOne(c.id)}
                style={{ marginRight: 8, cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 10, color: C.gray }}>{c.phoneE164}</div>
              </div>
              <span style={{ ...S.chip, background: C.tealBg, color: C.teal, fontSize: 9, flexShrink: 0 }}>
                {c.optInStatus}
              </span>
            </label>
          ))}
        </div>
      )}

      <div style={S.btnRow}>
        <button style={S.btnSecondary} onClick={p.onPublicoBack}>{'<'} Voltar</button>
        <button
          style={{ ...S.btnPrimary, flex: 2, opacity: p.selectedContactIds.size ? 1 : 0.45 }}
          disabled={!p.selectedContactIds.size}
          onClick={p.onPublicoNext}
        >
          Proximo ({p.selectedContactIds.size}) {'>'}
        </button>
      </div>
    </div>
  )
}

// â”€â”€ Step 3: Mensagem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepMensagem(p: DisparProps) {
  const preview = p.buildPreview(p.selectedContacts[0]?.name ?? 'cliente')
  const [localMsg, setLocalMsg] = useState(p.customMessage || preview)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setLocalMsg(e.target.value)
    p.setCustomMessage(e.target.value)
  }

  // Sync if campaign/hotel changes while on this step
  useEffect(() => {
    if (!p.customMessage) setLocalMsg(preview)
  }, [preview, p.customMessage])

  return (
    <div style={S.stepContent}>
      <p style={S.stepTitle}>Revise a mensagem</p>
      <p style={{ fontSize: 10, color: C.gray, margin: '0 0 8px' }}>
        {p.selectedContactIds.size} contato(s) - preview para {p.selectedContacts[0]?.name ?? '...'}
      </p>

      <textarea
        style={S.textarea}
        value={localMsg}
        onChange={handleChange}
        rows={11}
        spellCheck
      />
      <p style={{ fontSize: 10, color: C.gray, margin: '4px 0 0' }}>
        Editar aqui aplica o mesmo texto para todos. Deixe em branco para personalizar por contato.
      </p>

      <div style={S.btnRow}>
        <button style={S.btnSecondary} onClick={p.onMensagemBack}>{'<'} Voltar</button>
        <button style={{ ...S.btnPrimary, flex: 2 }} onClick={p.onMensagemNext}>
          Iniciar envio {'>'}
        </button>
      </div>
    </div>
  )
}

// â”€â”€ Step 4: Envio assistido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepEnvio(p: DisparProps) {
  const total   = p.sendContacts.length
  const contact = p.sendContacts[p.sendIndex]
  const done    = p.sendIndex >= total

  if (done) {
    return (
      <div style={{ ...S.center, flexDirection: 'column', gap: 14, paddingTop: 40 }}>
        <span style={{ fontSize: 40 }}>OK</span>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.teal, margin: 0 }}>Campanha concluida!</p>
        <p style={{ fontSize: 12, color: C.gray, textAlign: 'center', margin: 0 }}>
          {p.sendDone} enviado(s) - {p.sendSkipped} pulado(s)
        </p>
        <button style={S.btnPrimary} onClick={p.onReset}>
          Nova campanha
        </button>
      </div>
    )
  }

  const pct = Math.round((p.sendIndex / total) * 100)
  const msgPreview = p.buildPreview(contact.name)

  return (
    <div style={S.stepContent}>
      {/* Progresso */}
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${pct}%` }} />
      </div>
      <p style={{ fontSize: 10, color: C.gray, textAlign: 'center', margin: '2px 0 12px' }}>
        {p.sendIndex + 1} / {total} - {p.sendDone} enviado(s)
      </p>

      {/* Contato atual */}
      <div style={S.contactCard}>
        <span style={{ fontSize: 11, color: C.gray }}>Contato atual</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{contact.name}</span>
        <span style={{ fontSize: 11, color: C.gray }}>{contact.phoneE164}</span>
      </div>

      {/* Preview da mensagem */}
      <div style={{ ...S.msgBox, marginTop: 8 }}>
        <p style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: C.text, margin: 0, lineHeight: 1.5 }}>
          {msgPreview}
        </p>
      </div>

      <p style={{ fontSize: 10, color: C.gray, margin: '6px 0 10px' }}>
        1. Abra o chat deste contato no WhatsApp  2. Clique em "Colar"
      </p>

      <p style={{ fontSize: 10, color: C.gray, margin: '0 0 10px' }}>
        No lote, a extensao tenta abrir, colar e enviar automaticamente cada contato.
      </p>

      <div style={{ ...S.msgBox, marginTop: 0, marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: C.text, margin: '0 0 6px', fontWeight: 700 }}>
          Imagem local para o lote (opcional)
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={e => p.onPickLocalOfferImage(e.target.files?.[0] ?? null)}
          style={{ width: '100%', fontSize: 11 }}
        />
        {p.localOfferImageName && (
          <p style={{ fontSize: 10, color: C.textSm, margin: '6px 0 0' }}>
            Arquivo selecionado: {p.localOfferImageName}
          </p>
        )}
        {p.localOfferImageError && (
          <p style={{ fontSize: 10, color: C.danger, margin: '6px 0 0' }}>
            {p.localOfferImageError}
          </p>
        )}
        {p.localOfferImageDataUrl && (
          <button
            style={{ ...S.btnGhost, marginTop: 8, height: 28, fontSize: 11 }}
            onClick={p.onClearLocalOfferImage}
          >
            Remover imagem local
          </button>
        )}
      </div>

      {p.sendError && (
        <p style={{ fontSize: 11, color: C.danger, margin: '0 0 8px' }}>
          {p.sendError}
        </p>
      )}

      {p.batchResult && (
        <p style={{ fontSize: 11, color: C.textSm, margin: '0 0 8px' }}>
          {p.batchResult}
        </p>
      )}

      {p.batchDebug && (
        <div style={{ ...S.msgBox, marginTop: 0, marginBottom: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <p style={{ fontSize: 10, color: '#1d4ed8', margin: '0 0 4px', fontWeight: 700 }}>
            Diagnostico do lote
          </p>
          <p style={{ fontSize: 10, color: C.textSm, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
            {p.batchDebug}
          </p>
        </div>
      )}

      <button style={{ ...S.btnPrimary, marginBottom: 8 }} onClick={p.onPaste}>
        Colar mensagem no chat atual
      </button>

      <button
        style={{ ...S.btnPrimary, marginBottom: 8, background: '#0f766e', opacity: p.batchRunning ? 0.6 : 1 }}
        onClick={p.onBatchSend}
        disabled={p.batchRunning}
      >
        {p.batchRunning ? 'Disparando lote...' : 'Disparar lote de 10'}
      </button>

      <div style={S.btnRow}>
        <button style={{ ...S.btnSecondary, flex: 1 }} onClick={p.onSkip}>
          Pular
        </button>
        <button
          style={{ ...S.btnPrimary, flex: 1, background: C.green }}
          onClick={p.onPaste}
        >
          Colar e avancar
        </button>
      </div>
    </div>
  )
}

// â•â• ResponderView â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface FunilProps {
  campaigns: Campaign[]
  pendingSends: PendingSend[]
  pendingSendsLoading: boolean
  pendingSendsError: string
  markRepliedError: string
  funnelOverview: MetricsOverview | null
  funnelSends: MetricsSends | null
  campaignSendsMap: Record<string, MetricsSends>
  funnelLoading: boolean
  funnelError: string
  funnelPeriodDays: number
  setFunnelPeriodDays: (days: number) => void
  onRefresh: () => void
  onRefreshPending: () => void
  onOpenChat: (phoneE164: string) => void
  onMarkReplied: (sendId: string) => void
}

function FunilView(p: FunilProps) {
  const summary = p.funnelSends ?? { stats: { SENT: 0, REPLIED: 0, CANCELLED: 0 }, rates: { reply: 0 }, period: `${p.funnelPeriodDays} dias` }
  const campaignRows = useMemo(() => {
    return p.campaigns
      .filter(c => c.isActive)
      .map(campaign => {
        const metrics = p.campaignSendsMap[campaign.id] ?? { stats: { SENT: 0, REPLIED: 0, CANCELLED: 0 }, rates: { reply: 0 }, period: `${p.funnelPeriodDays} dias` }
        const pending = p.pendingSends.filter(send => send.campaign?.id === campaign.id).length
        return { campaign, sent: metrics.stats.SENT, replied: metrics.stats.REPLIED, pending, replyRate: metrics.rates.reply }
      })
      .sort((a, b) => b.sent - a.sent || b.replied - a.replied)
  }, [p.campaignSendsMap, p.campaigns, p.funnelPeriodDays, p.pendingSends])

  const topReplyCampaign = campaignRows.find(row => row.replied > 0) ?? null
  const topPendingCampaign = [...campaignRows].sort((a, b) => b.pending - a.pending)[0] ?? null

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ ...S.stepTitle, margin: 0 }}>Funil comercial</p>
          <p style={{ fontSize: 11, color: C.gray, margin: '4px 0 0' }}>Disparos, respostas e pendencias por campanha.</p>
        </div>
        <button style={{ ...S.btnGhost, height: 30, fontSize: 11 }} onClick={p.onRefresh}>Atualizar</button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {[7, 30].map(days => (
          <button
            key={days}
            style={{ ...S.btnGhost, height: 28, fontSize: 11, flex: 1, background: p.funnelPeriodDays === days ? C.tealBg : C.white, borderColor: p.funnelPeriodDays === days ? C.teal : C.border, color: p.funnelPeriodDays === days ? C.teal : C.textSm }}
            onClick={() => p.setFunnelPeriodDays(days)}
          >
            {days} dias
          </button>
        ))}
      </div>

      {(p.funnelError || p.pendingSendsError || p.markRepliedError) && (
        <div style={{ ...S.msgBox, maxHeight: 'none', overflow: 'visible', background: '#fef2f2', border: '1px solid #fecaca' }}>
          {p.funnelError && <p style={{ fontSize: 11, color: C.danger, margin: 0 }}>{p.funnelError}</p>}
          {p.pendingSendsError && <p style={{ fontSize: 11, color: C.danger, margin: p.funnelError ? '6px 0 0' : 0 }}>{p.pendingSendsError}</p>}
          {p.markRepliedError && <p style={{ fontSize: 11, color: C.danger, margin: (p.funnelError || p.pendingSendsError) ? '6px 0 0' : 0 }}>{p.markRepliedError}</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={S.previewCard}><div style={{ fontSize: 10, color: C.gray }}>Disparos</div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{summary.stats.SENT}</div><div style={{ fontSize: 10, color: C.gray }}>{summary.period}</div></div>
        <div style={S.previewCard}><div style={{ fontSize: 10, color: C.gray }}>Respostas</div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{summary.stats.REPLIED}</div><div style={{ fontSize: 10, color: C.gray }}>status REPLIED</div></div>
        <div style={S.previewCard}><div style={{ fontSize: 10, color: C.gray }}>Taxa</div><div style={{ fontSize: 20, fontWeight: 800, color: summary.rates.reply >= 15 ? '#166534' : C.text }}>{summary.rates.reply.toFixed(1)}%</div><div style={{ fontSize: 10, color: C.gray }}>de resposta</div></div>
        <div style={S.previewCard}><div style={{ fontSize: 10, color: C.gray }}>Pendentes</div><div style={{ fontSize: 20, fontWeight: 800, color: '#92400e' }}>{p.pendingSends.length}</div><div style={{ fontSize: 10, color: C.gray }}>aguardando retorno</div></div>
      </div>

      {p.funnelOverview && (
        <div style={{ ...S.msgBox, maxHeight: 'none', overflow: 'visible', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSm }}><span>Envios hoje</span><strong>{p.funnelOverview.sendsToday}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSm }}><span>Envios 7 dias</span><strong>{p.funnelOverview.sendsWeek}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSm }}><span>Campanhas ativas</span><strong>{p.funnelOverview.activeCampaigns}</strong></div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ ...S.label, margin: 0 }}>Por campanha</p>
        {p.funnelLoading && campaignRows.length === 0 ? <p style={S.hint}>Carregando metricas...</p> : campaignRows.length === 0 ? <p style={S.hint}>Nenhuma campanha ativa para mostrar.</p> : campaignRows.map(row => (
          <div key={row.campaign.id} style={{ ...S.suggCard, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{row.campaign.name}</span>
                <span style={{ fontSize: 10, color: C.gray }}>{row.campaign.destination || 'Campanha ativa'}</span>
              </div>
              <span style={{ ...S.chip, background: row.replyRate >= 15 ? '#dcfce7' : '#f3f4f6', color: row.replyRate >= 15 ? '#166534' : '#4b5563' }}>{row.replyRate.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
              <div style={S.previewCard}><div style={{ fontSize: 9, color: C.gray }}>Disparos</div><div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{row.sent}</div></div>
              <div style={S.previewCard}><div style={{ fontSize: 9, color: C.gray }}>Respostas</div><div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{row.replied}</div></div>
              <div style={S.previewCard}><div style={{ fontSize: 9, color: C.gray }}>Pendentes</div><div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>{row.pending}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...S.msgBox, maxHeight: 'none', overflow: 'visible', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 11, color: C.textSm }}>Melhor campanha</span><strong style={{ fontSize: 11, color: C.text }}>{topReplyCampaign ? `${topReplyCampaign.campaign.name} (${topReplyCampaign.replied})` : 'Sem respostas ainda'}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 11, color: C.textSm }}>Mais pendencias</span><strong style={{ fontSize: 11, color: C.text }}>{topPendingCampaign ? `${topPendingCampaign.campaign.name} (${topPendingCampaign.pending})` : 'Sem pendencias'}</strong></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ ...S.label, margin: 0 }}>Pendentes recentes ({p.pendingSends.length})</p>
          <button style={S.btnLink} onClick={p.onRefreshPending}>Atualizar fila</button>
        </div>
        {p.pendingSendsLoading ? <p style={S.hint}>Carregando pendencias...</p> : p.pendingSends.length === 0 ? <p style={S.hint}>Nenhum contato aguardando resposta.</p> : p.pendingSends.slice(0, 8).map(send => (
          <div key={send.id} style={{ ...S.suggCard, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{send.contact?.name || 'Contato'}</span>
                <span style={{ fontSize: 10, color: C.gray }}>{send.campaign?.name || 'Campanha'} - {formatTimeAgo(send.sentAt)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...S.btnGhost, height: 28, fontSize: 10 }} onClick={() => send.contact?.phoneE164 && p.onOpenChat(send.contact.phoneE164)}>Abrir</button>
                <button style={{ ...S.btnPrimary, width: 'auto', padding: '6px 10px', fontSize: 10, background: '#16a34a' }} onClick={() => p.onMarkReplied(send.id)}>Respondido</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min atras`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h atras`
    const days = Math.floor(hours / 24)
    return `${days}d atras`
  } catch {
    return ''
  }
}
// PosView â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface PosTemplate { id: string; icon: string; label: string; text: string }
interface PosProps { templates: PosTemplate[]; chatName: string | null }

function PosView({ templates, chatName }: PosProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function handleColar(text: string, id: string) {
    const ok = fillCompose(text)
    if (ok) {
      setCopied(id)
      setTimeout(() => setCopied(null), 2500)
    }
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {!chatName && (
        <div style={S.warnBox}>
          Abra uma conversa para personalizar os textos com o nome do contato.
        </div>
      )}

      <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>
        Templates prontos para pos-venda. Clique para colar diretamente na conversa aberta.
      </p>

      {templates.map(t => (
        <div key={t.id} style={S.suggCard}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.teal, marginBottom: 6 }}>
            {t.icon} {t.label}
          </div>
          <p style={{ fontSize: 11, color: C.text, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {t.text}
          </p>
          <button
            style={{
              ...S.btnPrimary,
              marginTop: 8,
              padding: '5px 10px',
              fontSize: 11,
              background: copied === t.id ? C.green : C.teal,
            }}
            onClick={() => handleColar(t.text, t.id)}
          >
            {copied === t.id ? 'Colado!' : 'Colar no WhatsApp'}
          </button>
        </div>
      ))}
    </div>
  )
}

// â•â• Estilos â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const S: Record<string, React.CSSProperties> = {
  shell: {
    width: 340,
    height: '100vh',
    background: C.white,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: C.text,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    background: C.teal,
    flexShrink: 0,
  },
  logo: {
    background: 'rgba(255,255,255,0.18)',
    color: C.white,
    fontWeight: 800,
    fontSize: 11,
    borderRadius: 4,
    padding: '2px 5px',
    flexShrink: 0,
    letterSpacing: 0.5,
  },
  tabs: {
    display: 'flex',
    gap: 3,
    flex: 1,
  },
  tabBtn: {
    flex: 1,
    padding: '5px 2px',
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 150ms, color 150ms',
  },
  tabActive: {
    background: C.white,
    color: C.teal,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    cursor: 'pointer',
    padding: '2px 4px',
    flexShrink: 0,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    padding: 16,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: C.gray,
    textAlign: 'center',
    margin: 0,
  },
  spinner: {
    width: 22,
    height: 22,
    border: `3px solid ${C.border}`,
    borderTop: `3px solid ${C.teal}`,
    borderRadius: '50%',
    animation: 'mv-spin 0.8s linear infinite',
  },
  spinnerSm: {
    width: 16,
    height: 16,
    border: `2px solid ${C.border}`,
    borderTop: `2px solid ${C.teal}`,
    borderRadius: '50%',
    animation: 'mv-spin 0.8s linear infinite',
  },
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
    background: C.bgLight,
    flexShrink: 0,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 800,
    flexShrink: 0,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: C.text,
    margin: '0 0 12px 0',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: C.textSm,
    marginBottom: 4,
    display: 'block',
  },
  select: {
    width: '100%',
    padding: '7px 8px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 10,
    background: C.white,
    color: C.text,
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '7px 8px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 8,
    background: C.white,
    color: C.text,
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '8px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 11,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    lineHeight: 1.55,
    color: C.text,
    boxSizing: 'border-box' as const,
    background: C.white,
  },
  contactList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 260,
    overflowY: 'auto',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    marginBottom: 10,
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 8px',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    fontSize: 12,
    background: C.white,
    gap: 4,
  },
  chip: {
    background: C.tealBg,
    color: C.teal,
    borderRadius: 4,
    padding: '2px 5px',
    fontSize: 9,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  previewCard: {
    background: C.bgAlt,
    border: `1px solid ${C.borderGreen}`,
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    marginBottom: 4,
  },
  btnPrimary: {
    width: '100%',
    padding: '9px',
    background: C.teal,
    color: C.white,
    border: 'none',
    borderRadius: 7,
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    padding: '9px',
    background: C.bgLight,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: C.teal,
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
    fontWeight: 600,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  contactCard: {
    background: C.bgLight,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  msgBox: {
    background: C.bgAlt,
    border: `1px solid ${C.borderGreen}`,
    borderRadius: 8,
    padding: '8px 10px',
    maxHeight: 160,
    overflowY: 'auto',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    background: C.border,
    borderRadius: 2,
    marginBottom: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: C.teal,
    borderRadius: 2,
    transition: 'width 300ms ease',
  },
  suggCard: {
    background: C.bgLight,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '10px',
  },
  warnBox: {
    background: '#fef9c3',
    border: '1px solid #fde68a',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    color: '#92400e',
  },
}
