// Painel lateral principal injetado no WhatsApp Web
// Tabs simplificadas: Fila (vendas do dia) | Contato (detalhes do lead aberto)

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  LeadInfo,
  Campaign,
  Hotel,
  PendingSend,
  LeadStageType,
  DetectedChat,
  CurrentChatState,
  ContactListItem,
  TaskListItem,
  MetricsOverview,
  MetricsFunnel,
} from '../shared/types'
import { LeadCard } from './LeadCard'
import { CampaignSender } from './CampaignSender'
import { SuggestedReply } from './SuggestedReply'
import { TaskPanel } from './TaskPanel'
import { useLastInboundMessage } from './hooks/useCurrentChat'

// ───── Tipos e constantes ─────

type Tab = 'fila' | 'contato'
type CreateStatus = 'idle' | 'loading' | 'ok' | 'error'
type QueueFilter = 'all' | 'tasks' | 'overdue'
type QueueItem = {
  id: string
  kind: 'task' | 'contact'
  contactId: string
  contactName: string
  phoneE164: string
  title: string
  stage: LeadStageType
  priority: number
  dueAt?: string
}

const STAGE_LABELS: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUOTE_REQUESTED: 'Cotacao',
  PROPOSAL_SENT: 'Proposta',
  CLOSED_WON: 'Fechado',
  CLOSED_LOST: 'Perdido',
  OPTED_OUT: 'Opt-out',
}

interface Props {
  currentChat: CurrentChatState | null
  onClose?: () => void
}

function safeSendMessage<T = unknown>(
  message: unknown,
  onResponse?: (response: T | undefined, runtimeError?: string) => void,
) {
  try {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        return onResponse?.(undefined, chrome.runtime.lastError.message)
      }
      onResponse?.(response as T, undefined)
    })
  } catch {
    onResponse?.(undefined, 'Falha ao enviar mensagem para o background')
  }
}

const CADENCE_BY_STAGE: Record<LeadStageType, { days: number; title: string }> = {
  NEW: { days: 1, title: 'Primeiro follow-up comercial' },
  CONTACTED: { days: 2, title: 'Retomar contato comercial' },
  QUOTE_REQUESTED: { days: 1, title: 'Enviar/confirmar cotacao' },
  PROPOSAL_SENT: { days: 3, title: 'Follow-up da proposta enviada' },
  CLOSED_WON: { days: 7, title: 'Pos-venda e indicacoes' },
  CLOSED_LOST: { days: 7, title: 'Reativacao de oportunidade perdida' },
  OPTED_OUT: { days: 30, title: 'Nao contatar (revisao interna)' },
}

const DEFAULT_PROFILE_OPTIONS = ['casal', 'familia', 'premium']
const DEFAULT_FOCUS_OPTIONS = ['praia', 'internacional', 'campo']

const SALES_TEMPLATES: Record<string, Record<string, string>> = {
  casal: {
    praia: 'Oi {{nome}}, montei uma opcao de praia para casal com otimo custo-beneficio e condicoes desta semana. Quer que eu te envie os detalhes agora?',
    internacional: 'Oi {{nome}}, tenho uma opcao internacional para casal com parcelamento facilitado e pouca burocracia. Posso te mandar os valores?',
    campo: 'Oi {{nome}}, se quiser um descanso em hotel no campo, tenho uma opcao excelente para os proximos dias. Te envio?',
  },
  familia: {
    praia: 'Oi {{nome}}, preparei uma sugestao de praia para familia com crianca, hotel bem avaliado e condicao especial. Posso te mostrar agora?',
    internacional: 'Oi {{nome}}, tenho uma opcao internacional para familia com roteiro pratico e suporte completo. Quer receber as alternativas?',
    campo: 'Oi {{nome}}, montei uma opcao de campo para familia com estrutura e tranquilidade. Posso enviar?',
  },
  premium: {
    praia: 'Oi {{nome}}, selecionei uma experiencia premium de praia com hotel exclusivo e beneficios diferenciados. Quer ver as opcoes?',
    internacional: 'Oi {{nome}}, tenho uma proposta internacional premium com servicos personalizados. Posso compartilhar agora?',
    campo: 'Oi {{nome}}, preparei uma opcao premium no campo com foco total em conforto e praticidade. Te envio?',
  },
}

const SALES_TEMPLATE_STORAGE_KEY = 'mv_sales_template_custom'
const SALES_PROFILE_OPTIONS_STORAGE_KEY = 'mv_sales_profile_options'
const SALES_FOCUS_OPTIONS_STORAGE_KEY = 'mv_sales_focus_options'


// ───── Componente principal ─────

export function SidePanel({ currentChat, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('fila')
  const [lead, setLead] = useState<LeadInfo | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [contactId, setContactId] = useState<string>()
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState('')
  const [lastGoodChat, setLastGoodChat] = useState<DetectedChat | null>(null)
  const [createStatus, setCreateStatus] = useState<CreateStatus>('idle')
  const [createMsg, setCreateMsg] = useState('')
  const [todayContacts, setTodayContacts] = useState<ContactListItem[]>([])
  const [todayTasks, setTodayTasks] = useState<TaskListItem[]>([])
  const [todayLoading, setTodayLoading] = useState(false)
  const [todayError, setTodayError] = useState('')
  const [todayActionMsg, setTodayActionMsg] = useState('')
  const [, setOverview] = useState<MetricsOverview | null>(null)
  const [, setFunnel] = useState<MetricsFunnel | null>(null)
  const [profileOptions, setProfileOptions] = useState<string[]>(DEFAULT_PROFILE_OPTIONS)
  const [focusOptions, setFocusOptions] = useState<string[]>(DEFAULT_FOCUS_OPTIONS)
  const [templateProfile, setTemplateProfile] = useState<string>(DEFAULT_PROFILE_OPTIONS[0])
  const [templateFocus, setTemplateFocus] = useState<string>(DEFAULT_FOCUS_OPTIONS[0])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [pendingSends, setPendingSends] = useState<PendingSend[]>([])
  const [customSalesTemplate, setCustomSalesTemplate] = useState('')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [queueSearch, setQueueSearch] = useState('')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')

  // ── Derivados do chat atual ──

  const liveChat = currentChat?.type === 'CHAT' ? currentChat.chat : null
  const isViewProfile = currentChat?.type === 'VIEW_PROFILE'
  const isChatNoJid = currentChat?.type === 'CHAT_NO_JID'

  useEffect(() => {
    if (liveChat?.phoneE164) setLastGoodChat(liveChat)
  }, [liveChat?.name, liveChat?.phoneE164])

  const noJidChat: DetectedChat | null = isChatNoJid
    ? { name: currentChat.name, phoneE164: null }
    : null

  const noJidMatchesLastGood = Boolean(
    noJidChat?.name &&
    lastGoodChat?.name &&
    noJidChat.name.trim().toLowerCase() === lastGoodChat.name.trim().toLowerCase(),
  )

  const effectiveChat =
    liveChat
    ?? (noJidMatchesLastGood ? lastGoodChat : noJidChat)
    ?? lastGoodChat

  const usingLastGoodChat = Boolean(lastGoodChat) && (
    isViewProfile
    || currentChat === null
    || (isChatNoJid && noJidMatchesLastGood)
  )
  const hasPhone = Boolean(effectiveChat?.phoneE164)
  const lastMsg = useLastInboundMessage(effectiveChat?.name)
  const selectedHotelObj = useMemo(
    () => hotels.find(h => h.id === selectedHotelId) ?? null,
    [hotels, selectedHotelId],
  )
  const selectedHotelName = selectedHotelObj?.name ?? ''

  useEffect(() => {
    if (hotels.length === 0) { setSelectedHotelId(''); return }
    if (!selectedHotelId || !hotels.find(h => h.id === selectedHotelId)) {
      setSelectedHotelId(hotels[0].id)
    }
  }, [hotels, selectedHotelId])

  // ── Loaders ──

  const loadCampaigns = useCallback(() => {
    safeSendMessage<{ campaigns?: Campaign[] }>({ type: 'GET_CAMPAIGNS' }, res => {
      if (res?.campaigns) setCampaigns(res.campaigns as Campaign[])
    })
  }, [])

  const loadTodayQueue = useCallback(() => {
    setTodayLoading(true)
    setTodayError('')
    let pending = 2
    let failed: string | null = null

    const finish = () => {
      pending -= 1
      if (pending > 0) return
      setTodayLoading(false)
      if (failed) setTodayError(failed)
    }

    safeSendMessage<{ contacts?: ContactListItem[]; total?: number; page?: number; limit?: number }>(
      { type: 'GET_CONTACTS', page: 1, limit: 80 },
      (res, runtimeError) => {
        if (runtimeError) {
          failed = failed ?? runtimeError
          finish()
          return
        }
        setTodayContacts(res?.contacts ?? [])
        finish()
      },
    )

    safeSendMessage<{ tasks?: TaskListItem[] }>(
      { type: 'GET_TASKS', done: false },
      (res, runtimeError) => {
        if (runtimeError) {
          failed = failed ?? runtimeError
          finish()
          return
        }
        setTodayTasks(res?.tasks ?? [])
        finish()
      },
    )
  }, [])

  const loadMetrics = useCallback(() => {
    safeSendMessage<{ overview?: MetricsOverview }>({ type: 'GET_METRICS_OVERVIEW' }, res => {
      if (res?.overview) setOverview(res.overview)
    })
    safeSendMessage<{ funnel?: MetricsFunnel }>({ type: 'GET_METRICS_FUNNEL' }, res => {
      if (res?.funnel) setFunnel(res.funnel)
    })
  }, [])

  const loadHotels = useCallback(() => {
    safeSendMessage<{ hotels?: Hotel[] }>({ type: 'GET_HOTELS' }, res => {
      if (res?.hotels) setHotels(res.hotels.filter(h => h.isActive))
    })
  }, [])

  const loadPendingSends = useCallback(() => {
    safeSendMessage<{ sends?: PendingSend[] }>({ type: 'GET_PENDING_SENDS', days: 7 }, res => {
      setPendingSends(res?.sends ?? [])
    })
  }, [])

  // ── Storage de templates ──

  useEffect(() => {
    chrome.storage.local.get(SALES_TEMPLATE_STORAGE_KEY)
      .then(data => {
        const value = data[SALES_TEMPLATE_STORAGE_KEY]
        if (typeof value === 'string') setCustomSalesTemplate(value)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    chrome.storage.local.get([SALES_PROFILE_OPTIONS_STORAGE_KEY, SALES_FOCUS_OPTIONS_STORAGE_KEY])
      .then(data => {
        const storedProfiles = data[SALES_PROFILE_OPTIONS_STORAGE_KEY]
        const storedFocus = data[SALES_FOCUS_OPTIONS_STORAGE_KEY]
        if (Array.isArray(storedProfiles) && storedProfiles.length > 0) {
          const sanitized = storedProfiles.map(v => String(v).trim()).filter(Boolean)
          if (sanitized.length > 0) {
            setProfileOptions(sanitized)
            setTemplateProfile(prev => sanitized.includes(prev) ? prev : sanitized[0])
          }
        }
        if (Array.isArray(storedFocus) && storedFocus.length > 0) {
          const sanitized = storedFocus.map(v => String(v).trim()).filter(Boolean)
          if (sanitized.length > 0) {
            setFocusOptions(sanitized)
            setTemplateFocus(prev => sanitized.includes(prev) ? prev : sanitized[0])
          }
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    chrome.storage.local.set({ [SALES_TEMPLATE_STORAGE_KEY]: customSalesTemplate }).catch(() => undefined)
  }, [customSalesTemplate])

  useEffect(() => {
    chrome.storage.local.set({ [SALES_PROFILE_OPTIONS_STORAGE_KEY]: profileOptions }).catch(() => undefined)
  }, [profileOptions])

  useEffect(() => {
    chrome.storage.local.set({ [SALES_FOCUS_OPTIONS_STORAGE_KEY]: focusOptions }).catch(() => undefined)
  }, [focusOptions])

  // ── Auth + bootstrap ──

  useEffect(() => {
    safeSendMessage<{ authenticated?: boolean; error?: string }>({ type: 'PING' }, (res, runtimeError) => {
      setAuthOk(res?.authenticated ?? false)
      setAuthError(runtimeError ?? res?.error ?? '')
    })
    loadCampaigns()
    loadTodayQueue()
    loadMetrics()
    loadHotels()
    loadPendingSends()

    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes['mv_settings']) {
        safeSendMessage<{ authenticated?: boolean; error?: string }>({ type: 'PING' }, (res, runtimeError) => {
          setAuthOk(res?.authenticated ?? false)
          setAuthError(runtimeError ?? res?.error ?? '')
        })
        loadCampaigns()
        loadTodayQueue()
        loadMetrics()
        loadHotels()
        loadPendingSends()
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [loadCampaigns, loadTodayQueue, loadMetrics, loadHotels, loadPendingSends])

  // ── Lead loader ──

  const loadLeadByPhone = useCallback((phoneE164: string) => {
    setLoading(true)
    safeSendMessage<{ lead?: LeadInfo }>({ type: 'GET_LEAD', phoneE164 }, res => {
      setLoading(false)
      if (res?.lead) {
        setLead(res.lead as LeadInfo)
        setContactId((res.lead as LeadInfo).contactId)
      } else {
        setLead(null)
        setContactId(undefined)
      }
    })
  }, [])

  useEffect(() => {
    setLead(null)
    setContactId(undefined)
    setCreateStatus('idle')
    setCreateMsg('')
    if (!effectiveChat?.phoneE164) return
    loadLeadByPhone(effectiveChat.phoneE164)
  }, [effectiveChat?.phoneE164, loadLeadByPhone])

  // ── Handlers ──

  const handleStageChange = useCallback((stage: LeadStageType) => {
    if (!contactId) return
    safeSendMessage({ type: 'UPDATE_STAGE', contactId, stage }, () => {
      setLead(prev => prev ? { ...prev, stage } : null)
    })
  }, [contactId])

  const handleCreateTask = useCallback((title: string, dueAt?: string) => {
    if (!contactId) return
    safeSendMessage<{ task?: LeadInfo['tasks'][number] }>({ type: 'CREATE_TASK', contactId, title, dueAt }, res => {
      const newTask = res?.task
      if (!newTask) return
      setLead(prev => prev ? { ...prev, tasks: [...prev.tasks, newTask] } : null)
    })
  }, [contactId])

  const handleBlock = useCallback(() => {
    if (!contactId) return
    safeSendMessage({ type: 'UPDATE_STAGE', contactId, stage: 'OPTED_OUT' }, () => {
      setLead(prev => prev ? { ...prev, stage: 'OPTED_OUT' } : null)
    })
    safeSendMessage({ type: 'LOG_EVENT', contactId, eventType: 'OPT_OUT', payload: { source: 'extension' } })
  }, [contactId])

  const handleSendOffer = useCallback((data: { campaignId?: string; hotelId: string; message: string }) => {
    if (!contactId) return
    safeSendMessage({
      type: 'LOG_ASSISTED_SEND',
      contactId,
      campaignId: data.campaignId,
      hotelId: data.hotelId,
      notes: `Oferta enviada: ${data.message.split('\n')[0]}`,
    }, () => {
      setTodayActionMsg('✅ Oferta registrada no sistema.')
    })
  }, [contactId])

  const handleCompleteTask = useCallback((taskId: string) => {
    safeSendMessage({ type: 'COMPLETE_TASK', taskId })
    setLead(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, done: true } : t),
    } : null)
  }, [])

  const handleCreateContact = useCallback(() => {
    const chat = effectiveChat
    if (!chat?.phoneE164) return

    setCreateStatus('loading')
    setCreateMsg('')
    safeSendMessage<{ ok?: boolean; contactId?: string; error?: string }>(
      { type: 'CREATE_CONTACT', name: chat.name, phoneE164: chat.phoneE164 },
      (res, runtimeError) => {
        if (!res?.ok) {
          setCreateStatus('error')
          setCreateMsg(runtimeError ?? res?.error ?? 'Falha ao criar contato')
          return
        }
        setCreateStatus('ok')
        setCreateMsg('Contato criado no backend.')
        loadLeadByPhone(chat.phoneE164!)
        window.open(`http://localhost:3000/contacts?phone=${encodeURIComponent(chat.phoneE164!)}`, '_blank')
      },
    )
  }, [effectiveChat, loadLeadByPhone])

  // ── Fila de vendas ──

  const queueItems = useMemo<QueueItem[]>(() => {
    const stageWeight: Record<string, number> = {
      QUOTE_REQUESTED: 100,
      PROPOSAL_SENT: 90,
      CONTACTED: 70,
      NEW: 60,
    }
    const openTaskByContact = new Set(todayTasks.filter(t => !t.done).map(t => t.contactId))
    const taskItems = todayTasks
      .filter(t => !t.done)
      .map(task => {
        const dueTs = task.dueAt ? new Date(task.dueAt).getTime() : Number.MAX_SAFE_INTEGER
        return {
          id: `task-${task.id}`,
          kind: 'task' as const,
          contactId: task.contactId,
          contactName: task.contact?.name ?? 'Contato',
          phoneE164: task.contact?.phoneE164 ?? '',
          title: task.title,
          stage: 'CONTACTED' as LeadStageType,
          priority: dueTs < Date.now() ? 120 : 80,
          dueAt: task.dueAt,
        }
      })

    const contactItems = todayContacts
      .filter(c => !c.blocked && c.optInStatus !== 'BLOCKED')
      .filter(c => !openTaskByContact.has(c.id))
      .map(contact => {
        const stage = (contact.leadStage?.stage ?? 'NEW') as LeadStageType
        if (stage === 'CLOSED_WON' || stage === 'CLOSED_LOST' || stage === 'OPTED_OUT') return null
        const updatedTs = contact.updatedAt ? new Date(contact.updatedAt).getTime() : new Date(contact.createdAt).getTime()
        const staleHours = (Date.now() - updatedTs) / 36e5
        const staleBoost = staleHours >= 72 ? 25 : staleHours >= 24 ? 12 : 0
        const priority = (stageWeight[stage] ?? 50) + staleBoost
        return {
          id: `contact-${contact.id}`,
          kind: 'contact' as const,
          contactId: contact.id,
          contactName: contact.name,
          phoneE164: contact.phoneE164,
          title: staleHours >= 24 ? `Sem follow-up ha ${Math.floor(staleHours)}h` : 'Acao comercial recomendada',
          stage,
          priority,
          dueAt: undefined as string | undefined,
        }
      })
      .filter(Boolean) as QueueItem[]

    return [...taskItems, ...contactItems].sort((a, b) => b.priority - a.priority).slice(0, 20)
  }, [todayContacts, todayTasks])

  const queueStats = useMemo(() => {
    const total = queueItems.length
    const tasks = queueItems.filter(item => item.kind === 'task').length
    const overdue = queueItems.filter(item => item.kind === 'task' && item.dueAt && new Date(item.dueAt) < new Date()).length
    return { total, tasks, overdue }
  }, [queueItems])

  const filteredQueueItems = useMemo(() => {
    const normalized = queueSearch.trim().toLowerCase()
    return queueItems.filter(item => {
      if (queueFilter === 'tasks' && item.kind !== 'task') return false
      if (queueFilter === 'overdue') {
        if (item.kind !== 'task') return false
        if (!item.dueAt || new Date(item.dueAt) >= new Date()) return false
      }
      if (!normalized) return true
      const haystack = `${item.contactName} ${item.title} ${item.phoneE164}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [queueFilter, queueItems, queueSearch])

  // ── Template helpers ──

  // openChatByPhone removido — agora usamos handleCopyAndOpen direto

  const getSuggestedTemplate = useCallback(() => {
    const byProfile = SALES_TEMPLATES[templateProfile] ?? SALES_TEMPLATES.casal
    return byProfile[templateFocus] ?? byProfile.praia ?? 'Oi {{nome}}, tenho uma opcao ideal para sua viagem. Posso te enviar agora?'
  }, [templateFocus, templateProfile])

  const buildSalesScript = useCallback((name: string, stage: LeadStageType) => {
    const firstName = name.split(' ')[0]
    const baseTemplate = (customSalesTemplate.trim() || getSuggestedTemplate())
      .replace(/\{\{nome\}\}/gi, name)
      .replace(/\{\{primeiro_nome\}\}/gi, firstName)
      .replace(/\{\{estagio\}\}/gi, stage)
      .replace(/\{\{perfil\}\}/gi, templateProfile)
      .replace(/\{\{foco\}\}/gi, templateFocus)
      .replace(/\{\{hotel\}\}/gi, selectedHotelName || 'hotel selecionado')
      .replace(/\{\{dia\}\}/gi, new Date().toLocaleDateString('pt-BR'))

    const templateBase = baseTemplate
    switch (stage) {
      case 'QUOTE_REQUESTED':
        return `${templateBase}\n\nJa deixei duas opcoes para voce comparar agora.`
      case 'PROPOSAL_SENT':
        return `${templateBase}\n\nPosso te ajudar a escolher a melhor proposta ainda hoje?`
      case 'CONTACTED':
        return `${templateBase}\n\nTenho disponibilidade atualizada para fechar sem perder tarifa.`
      default:
        return templateBase
    }
  }, [customSalesTemplate, getSuggestedTemplate, selectedHotelName, templateFocus, templateProfile])

  useEffect(() => {
    if (!todayActionMsg) return
    const t = setTimeout(() => setTodayActionMsg(''), 4000)
    return () => clearTimeout(t)
  }, [todayActionMsg])

  // handleCopyScript removido — agora usamos handleCopyAndOpen (copia + abre)

  const handleCopyAndOpen = useCallback(async (
    contactName: string,
    stage: LeadStageType,
    phoneE164: string,
    contactId: string,
  ) => {
    const text = buildSalesScript(contactName, stage)

    // 1. Copiar imagem do hotel para clipboard (para o agente colar no WhatsApp)
    const imageUrl = selectedHotelObj?.images?.[0]
    if (imageUrl) {
      try {
        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `http://127.0.0.1:3001${imageUrl}`
        const resp = await fetch(fullUrl)
        const blob = await resp.blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        setTodayActionMsg('Imagem copiada! Abra o chat e cole (Ctrl+V) a imagem primeiro.')
      } catch {
        // fallback: copia texto
        try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
        setTodayActionMsg('Script copiado! Abrindo chat...')
      }
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setTodayActionMsg('Script copiado! Abrindo chat...')
      } catch {
        setTodayActionMsg('Cole manualmente. Abrindo chat...')
      }
    }

    // 2. Logar envio assistido (best-effort, sem bloquear UI)
    const firstCampaignId = campaigns[0]?.id
    safeSendMessage({
      type:       'LOG_ASSISTED_SEND',
      contactId,
      campaignId: firstCampaignId,
      hotelId:    selectedHotelObj?.id,
      notes:      `Abordagem: ${STAGE_LABELS[stage] ?? stage}`,
    })

    // 3. Abrir chat
    const digits = phoneE164.replace(/\D/g, '')
    if (digits) {
      setTimeout(() => {
        window.location.href = `https://web.whatsapp.com/send?phone=${digits}`
      }, 300)
    }
  }, [buildSalesScript, campaigns, selectedHotelObj])

  const handleCreateFollowupTask = useCallback((contactId: string, contactName: string, stage: LeadStageType) => {
    const cadence = CADENCE_BY_STAGE[stage] ?? CADENCE_BY_STAGE.NEW
    const due = new Date(Date.now() + cadence.days * 24 * 60 * 60 * 1000).toISOString()
    const title = `${cadence.title} - ${contactName}`
    safeSendMessage<{ ok?: boolean; error?: string }>(
      { type: 'CREATE_TASK', contactId, title, dueAt: due },
      (res, runtimeError) => {
        if (!res?.ok) {
          setTodayActionMsg(runtimeError ?? res?.error ?? 'Falha ao criar follow-up')
          return
        }
        setTodayActionMsg(`Follow-up criado para D+${cadence.days}.`)
        loadTodayQueue()
      },
    )
  }, [loadTodayQueue])

  // ── Tab label dinamica ──

  const contatoTabLabel = effectiveChat?.name
    ? (effectiveChat.name.length > 14
        ? effectiveChat.name.slice(0, 14) + '\u2026'
        : effectiveChat.name)
    : 'Contato'

  // ───── RENDER ─────

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>Minha Viagem</div>
          <div style={{ fontSize: 10, opacity: 0.7 }}>
            {authOk === null
              ? 'verificando...'
              : authOk
                ? '\u25CF Conectado'
                : authError
                  ? `\u25CB ${authError}`
                  : '\u25CB Desconectado'}
          </div>
        </div>
        <button onClick={onClose} type="button" title="Fechar painel" style={closeBtn}>
          {'\u2715'}
        </button>
      </div>

      {/* Tab bar - 2 tabs */}
      <div style={tabBar}>
        <button
          onClick={() => setTab('fila')}
          style={tabBtnStyle(tab === 'fila')}
        >
          {'\u{1F4CB}'} Fila{queueItems.length > 0 ? ` (${queueItems.length})` : ''}
        </button>
        <button
          onClick={() => setTab('contato')}
          style={tabBtnStyle(tab === 'contato')}
        >
          {'\u{1F464}'} {contatoTabLabel}
        </button>
      </div>

      {/* Conteudo */}
      <div style={contentArea}>
        {tab === 'fila' ? (
          /* ════════ ABA FILA ════════ */
          authOk === false ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F512}'}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Faca login para ver sua fila de vendas.
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Clique no icone da extensao no Chrome e entre com seu email e senha.
              </div>
              {authError && (
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 10 }}>
                  {authError}
                </div>
              )}
            </div>
          ) : todayLoading || authOk === null ? (
            <Placeholder icon={'\u{1F4C8}'} text="Montando fila de vendas..." />
          ) : (
            <div style={{ padding: 12 }}>
              {/* Header da fila */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                  Fila do dia
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setShowTemplateEditor(v => !v)} style={iconBtn} title="Personalizar script">
                    {'\u270F\uFE0F'}
                  </button>
                  <button onClick={() => { loadTodayQueue(); loadMetrics() }} style={iconBtn} title="Atualizar">
                    {'\u{1F504}'}
                  </button>
                </div>
              </div>
              <div style={statsRow}>
                <div style={statCard}>
                  <div style={statLabel}>Total</div>
                  <div style={statValue}>{queueStats.total}</div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>Tarefas</div>
                  <div style={statValue}>{queueStats.tasks}</div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>Vencidas</div>
                  <div style={{ ...statValue, color: queueStats.overdue > 0 ? '#dc2626' : '#0f172a' }}>{queueStats.overdue}</div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <input
                  value={queueSearch}
                  onChange={e => setQueueSearch(e.target.value)}
                  placeholder="Buscar contato, telefone ou tarefa..."
                  style={queueSearchInput}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button
                  style={queueFilterBtn(queueFilter === 'all')}
                  onClick={() => setQueueFilter('all')}
                >
                  Todos
                </button>
                <button
                  style={queueFilterBtn(queueFilter === 'tasks')}
                  onClick={() => setQueueFilter('tasks')}
                >
                  Tarefas
                </button>
                <button
                  style={queueFilterBtn(queueFilter === 'overdue')}
                  onClick={() => setQueueFilter('overdue')}
                >
                  Vencidas
                </button>
              </div>

              {/* Seletores de perfil/foco/hotel - compactos */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <select
                  value={templateProfile}
                  onChange={e => setTemplateProfile(e.target.value)}
                  style={selectCompact}
                >
                  {profileOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                  value={templateFocus}
                  onChange={e => setTemplateFocus(e.target.value)}
                  style={selectCompact}
                >
                  {focusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {hotels.length > 0 && (
                  <select
                    value={selectedHotelId}
                    onChange={e => setSelectedHotelId(e.target.value)}
                    style={{ ...selectCompact, flex: 1, minWidth: 0 }}
                  >
                    <option value="">-- hotel --</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name}{h.destination ? ` · ${h.destination}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Preview do hotel selecionado */}
              {selectedHotelObj && (
                <div style={hotelPreviewCard}>
                  {selectedHotelObj.images?.[0] && (
                    <img
                      src={(() => {
                        const img = selectedHotelObj.images[0]
                        return img.startsWith('http') ? img : img
                      })()}
                      alt={selectedHotelObj.name}
                      style={hotelPreviewImg}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedHotelObj.name}
                      {selectedHotelObj.stars ? ` ${'⭐'.repeat(Math.min(selectedHotelObj.stars, 5))}` : ''}
                    </div>
                    {selectedHotelObj.destination && (
                      <div style={{ fontSize: 10, color: '#64748b' }}>{selectedHotelObj.destination}</div>
                    )}
                    {selectedHotelObj.priceFrom && (
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                        A partir de R$ {selectedHotelObj.priceFrom.toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  {selectedHotelObj.images?.[0] && (
                    <button
                      style={{ ...miniBtn, padding: '3px 7px', fontSize: 10 }}
                      title="Copiar imagem do hotel para o clipboard"
                      onClick={async () => {
                        try {
                          const resp = await fetch(selectedHotelObj.images[0])
                          const blob = await resp.blob()
                          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
                          setTodayActionMsg('📷 Imagem copiada! Cole no WhatsApp (Ctrl+V).')
                        } catch {
                          setTodayActionMsg('Nao foi possivel copiar a imagem.')
                        }
                      }}
                    >
                      📷
                    </button>
                  )}
                </div>
              )}

              {/* Editor de template avancado (toggle) */}
              {showTemplateEditor && (
                <div style={templateEditorBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Personalizar script de abordagem
                  </div>
                  <textarea
                    value={customSalesTemplate}
                    onChange={e => setCustomSalesTemplate(e.target.value)}
                    placeholder={'Use {{nome}}, {{perfil}}, {{foco}}, {{hotel}}, {{dia}}'}
                    style={templateTextarea}
                  />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input
                      value={profileOptions.join(', ')}
                      onChange={e => {
                        const next = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                        const valid = next.length > 0 ? next : DEFAULT_PROFILE_OPTIONS
                        setProfileOptions(valid)
                        setTemplateProfile(prev => valid.includes(prev) ? prev : valid[0])
                      }}
                      placeholder="Perfis: casal, familia..."
                      style={templateInput}
                    />
                    <input
                      value={focusOptions.join(', ')}
                      onChange={e => {
                        const next = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                        const valid = next.length > 0 ? next : DEFAULT_FOCUS_OPTIONS
                        setFocusOptions(valid)
                        setTemplateFocus(prev => valid.includes(prev) ? prev : valid[0])
                      }}
                      placeholder="Focos: praia, campo..."
                      style={templateInput}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setCustomSalesTemplate(getSuggestedTemplate())}
                      style={miniBtn}
                    >
                      Carregar modelo
                    </button>
                    <button
                      onClick={() => setShowTemplateEditor(false)}
                      style={miniBtn}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback messages */}
              {todayError && (
                <div style={errorBanner}>{todayError}</div>
              )}
              {todayActionMsg && (
                <div style={successBanner}>{'\u2705'} {todayActionMsg}</div>
              )}

              {/* Cards da fila */}
              {filteredQueueItems.length === 0 ? (
                <div style={emptyState}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{'\u{1F389}'}</div>
                  {queueItems.length === 0
                    ? 'Fila limpa! Hora de prospectar novos contatos.'
                    : 'Nenhum item encontrado com os filtros atuais.'}
                </div>
              ) : (
                filteredQueueItems.map(item => {
                  const isTask = item.kind === 'task'
                  const stageLabel = STAGE_LABELS[item.stage] ?? item.stage
                  const isOverdue = item.dueAt ? new Date(item.dueAt) < new Date() : false
                  return (
                    <div key={item.id} style={{ ...queueCard, borderLeft: `3px solid ${isTask ? (isOverdue ? '#ef4444' : '#f59e0b') : '#3b82f6'}` }}>
                      {/* Nome + stage */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                          {item.contactName}
                        </span>
                        <span style={stageBadge}>{stageLabel}</span>
                      </div>
                      {/* Descricao */}
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                        {item.title}
                        {isOverdue && <span style={{ color: '#dc2626', fontWeight: 600 }}> {'\u2022'} Vencida</span>}
                        {item.dueAt && !isOverdue && (
                          <span> {'\u2022'} {new Date(item.dueAt).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                      {/* Acoes: 1 principal + 1 secundaria */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        <button
                          style={primaryActionBtn}
                          onClick={() => handleCopyAndOpen(item.contactName, item.stage, item.phoneE164, item.contactId)}
                        >
                          {'\u25B6'} Abordar
                        </button>
                        <button
                          style={secondaryActionBtn}
                          onClick={() => handleCreateFollowupTask(item.contactId, item.contactName, item.stage)}
                        >
                          {'\u{1F4C5}'} Follow-up
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {/* ── Fila de respostas: enviados aguardando retorno ── */}
              {pendingSends.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                      💬 Aguardando resposta ({pendingSends.length})
                    </div>
                    <button
                      onClick={loadPendingSends}
                      style={iconBtn}
                      title="Atualizar respostas"
                    >
                      🔄
                    </button>
                  </div>
                  {pendingSends.map(send => {
                    const contact = send.contact
                    const sentDate = new Date(send.sentAt)
                    const hoursAgo = Math.floor((Date.now() - sentDate.getTime()) / 36e5)
                    return (
                      <div key={send.id} style={{ ...queueCard, borderLeft: '3px solid #8b5cf6', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                            {contact?.name ?? 'Contato'}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            {hoursAgo < 1 ? 'agora' : `${hoursAgo}h atrás`}
                          </span>
                        </div>
                        {send.campaign && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            Campanha: {send.campaign.name}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          {contact?.phoneE164 && (
                            <button
                              style={primaryActionBtn}
                              onClick={() => {
                                const digits = (contact.phoneE164).replace(/\D/g, '')
                                if (digits) window.location.href = `https://web.whatsapp.com/send?phone=${digits}`
                              }}
                            >
                              ▶ Abrir chat
                            </button>
                          )}
                          <button
                            style={{ ...secondaryActionBtn, background: '#d1fae5', color: '#065f46' }}
                            onClick={() => {
                              safeSendMessage({ type: 'MARK_REPLIED', sendId: send.id }, () => {
                                setPendingSends(prev => prev.filter(s => s.id !== send.id))
                                setTodayActionMsg('✅ Marcado como respondido.')
                              })
                            }}
                          >
                            ✓ Respondeu
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        ) : (
          /* ════════ ABA CONTATO ════════ */
          !effectiveChat ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F4AC}'}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Abra uma conversa no WhatsApp para ver o contato.
              </div>
              <button
                onClick={() => setTab('fila')}
                style={{ ...miniBtn, background: '#075e54', color: '#fff', border: 'none', fontWeight: 700 }}
              >
                {'\u{1F4CB}'} Ir para a Fila
              </button>
            </div>
          ) : loading ? (
            <Placeholder icon={'\u23F3'} text="Carregando dados do contato..." />
          ) : (
            <div>
              {/* Banners de contexto */}
              {usingLastGoodChat && (
                <div style={infoBanner}>
                  Exibindo o ultimo chat valido. Volte para a conversa para atualizar.
                </div>
              )}
              {isChatNoJid && (
                <div style={warnBanner}>
                  Chat aberto, mas nao consegui capturar o numero ainda.
                </div>
              )}

              {/* Lead info ou cadastro */}
              {lead ? (
                <LeadCard
                  contactId={contactId!}
                  contactName={effectiveChat.name}
                  lead={lead}
                  hotels={hotels}
                  campaigns={campaigns}
                  onStageChange={handleStageChange}
                  onCreateTask={handleCreateTask}
                  onBlock={handleBlock}
                  onSendOffer={handleSendOffer}
                  onOfferError={msg => setTodayActionMsg(`❌ ${msg}`)}
                  disableActions={!hasPhone}
                />
              ) : (
                <>
                  <NoContact
                    name={effectiveChat.name}
                    phone={effectiveChat.phoneE164 ?? undefined}
                  />
                  <CreateContactAction
                    creating={createStatus === 'loading'}
                    status={createStatus}
                    message={createMsg}
                    canCreate={hasPhone}
                    onCreate={handleCreateContact}
                  />
                </>
              )}

              {/* Sugestao de resposta (se tem msg recebida) */}
              {lastMsg && (
                <div style={sectionDivider}>
                  <div style={sectionHeader}>{'\u{1F4A1}'} Sugestao de resposta</div>
                  <SuggestedReply
                    lastMessage={lastMsg}
                    onStopDetected={handleBlock}
                  />
                </div>
              )}

              {/* Campanha - colapsavel */}
              <CollapsibleSection title={`\u{1F4E2} Enviar campanha`}>
                <CampaignSender
                  campaigns={campaigns}
                  currentChat={effectiveChat}
                  contactId={contactId}
                  disableActions={!hasPhone}
                />
              </CollapsibleSection>

              {/* Tarefas - colapsavel (so se tem lead) */}
              {lead && lead.tasks.length > 0 && (
                <CollapsibleSection title={`\u2705 Tarefas (${lead.tasks.filter(t => !t.done).length} pendentes)`}>
                  <TaskPanel tasks={lead.tasks} onComplete={handleCompleteTask} />
                </CollapsibleSection>
              )}
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div style={footer}>
        Envio assistido: confirme cada mensagem manualmente.
      </div>
    </div>
  )
}

// ───── Componentes internos ─────

function Placeholder({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  )
}

function NoContact({ name, phone }: { name: string; phone?: string }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
        {name} nao esta na base de contatos.
        {phone ? ` (${phone})` : ' Telefone nao disponivel.'}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
        Lembre de confirmar opt-in antes de enviar mensagens proativas.
      </div>
    </div>
  )
}

function CreateContactAction({
  creating, status, message, canCreate, onCreate,
}: {
  creating: boolean
  status: CreateStatus
  message: string
  canCreate: boolean
  onCreate: () => void
}) {
  return (
    <div style={{ padding: '0 14px 14px' }}>
      <button
        onClick={onCreate}
        disabled={!canCreate || creating}
        style={{
          display: 'block', width: '100%', padding: '7px 12px',
          background: !canCreate ? '#9ca3af' : '#075e54', color: '#fff',
          borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none',
          cursor: !canCreate || creating ? 'not-allowed' : 'pointer',
        }}
      >
        {creating ? 'Cadastrando...' : 'Cadastrar no dashboard'}
      </button>
      {!canCreate && (
        <div style={{ fontSize: 11, color: '#b45309', marginTop: 8 }}>
          Volte para a conversa para capturar o numero.
        </div>
      )}
      {status === 'ok' && (
        <div style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>{message}</div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 8 }}>{message}</div>
      )}
    </div>
  )
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid #f1f5f9' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={collapsibleBtn}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && children}
    </div>
  )
}

// ───── Estilos ─────

const panel: React.CSSProperties = {
  width: '100%', height: '100%',
  background: '#fff',
  display: 'flex', flexDirection: 'column',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxSizing: 'border-box', overflow: 'hidden',
}

const header: React.CSSProperties = {
  background: '#075e54', color: '#fff',
  padding: '10px 12px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexShrink: 0,
}

const tabBar: React.CSSProperties = {
  display: 'flex', background: '#128c7e',
  flexShrink: 0,
}

const closeBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.35)',
  background: 'rgba(0,0,0,0.18)', color: '#fff',
  fontSize: 12, lineHeight: '22px', fontWeight: 700,
  cursor: 'pointer', flexShrink: 0, padding: 0,
}

const contentArea: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
}

const footer: React.CSSProperties = {
  padding: '5px 10px', borderTop: '1px solid #e5e7eb',
  fontSize: 10, color: '#9ca3af', textAlign: 'center', flexShrink: 0,
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '9px 4px', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #fff' : '2px solid transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    fontWeight: active ? 700 : 400,
    fontSize: 12, cursor: 'pointer',
  }
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  border: '1px solid #e2e8f0', background: '#f8fafc',
  fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const selectCompact: React.CSSProperties = {
  flex: 1, border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 11, color: '#334155', background: '#fff',
  padding: '5px 6px',
}

const statsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  marginBottom: 10,
}

const statCard: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#f8fafc',
  padding: '6px 8px',
}

const statLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#64748b',
  marginBottom: 2,
}

const statValue: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#0f172a',
}

const queueSearchInput: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 12,
  color: '#334155',
  background: '#fff',
  padding: '7px 8px',
  boxSizing: 'border-box',
}

function queueFilterBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: `1px solid ${active ? '#0ea5e9' : '#e2e8f0'}`,
    borderRadius: 999,
    background: active ? '#e0f2fe' : '#f8fafc',
    color: active ? '#0c4a6e' : '#475569',
    fontSize: 11,
    fontWeight: active ? 700 : 600,
    padding: '5px 8px',
    cursor: 'pointer',
  }
}

const miniBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6,
  border: '1px solid #cbd5e1', background: '#f8fafc',
  color: '#334155', fontSize: 11, cursor: 'pointer',
}

const hotelPreviewCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  border: '1px solid #c4b5fd', borderRadius: 8,
  padding: '6px 8px', marginBottom: 8, background: '#faf5ff',
}

const hotelPreviewImg: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 6,
  objectFit: 'cover', flexShrink: 0,
  border: '1px solid #e2e8f0',
}

const queueCard: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: 10, marginBottom: 8, background: '#fff',
}

const stageBadge: React.CSSProperties = {
  fontSize: 10, background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 10, padding: '1px 8px', color: '#475569', fontWeight: 600,
  whiteSpace: 'nowrap',
}

const primaryActionBtn: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 6,
  background: '#075e54', color: '#fff', border: 'none',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}

const secondaryActionBtn: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', background: '#f8fafc',
  color: '#475569', fontSize: 11, cursor: 'pointer',
}

const templateEditorBox: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: 10, marginBottom: 10,
}

const templateTextarea: React.CSSProperties = {
  width: '100%', minHeight: 70, marginBottom: 8,
  border: '1px solid #cbd5e1', borderRadius: 6,
  fontSize: 11, color: '#334155', background: '#fff',
  padding: 8, resize: 'vertical', boxSizing: 'border-box',
}

const templateInput: React.CSSProperties = {
  flex: 1, border: '1px solid #cbd5e1', borderRadius: 6,
  fontSize: 11, color: '#334155', background: '#fff',
  padding: '6px 8px',
}

const errorBanner: React.CSSProperties = {
  marginBottom: 8, fontSize: 12, color: '#b91c1c',
  background: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 6, padding: 8,
}

const successBanner: React.CSSProperties = {
  marginBottom: 8, fontSize: 12, color: '#166534',
  background: '#f0fdf4', border: '1px solid #bbf7d0',
  borderRadius: 6, padding: '6px 10px',
}

const emptyState: React.CSSProperties = {
  fontSize: 12, color: '#64748b', background: '#f8fafc',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: 14, textAlign: 'center',
}

const infoBanner: React.CSSProperties = {
  margin: '10px 12px', padding: 10,
  background: '#eff6ff', border: '1px solid #bfdbfe',
  borderRadius: 6, fontSize: 12, color: '#1e3a8a',
}

const warnBanner: React.CSSProperties = {
  margin: '10px 12px', padding: 10,
  background: '#fef9c3', border: '1px solid #fde68a',
  borderRadius: 6, fontSize: 12, color: '#854d0e',
}

const sectionDivider: React.CSSProperties = {
  borderTop: '1px solid #f1f5f9', marginTop: 4,
}

const sectionHeader: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#334155',
  padding: '10px 12px 0',
}

const collapsibleBtn: React.CSSProperties = {
  width: '100%', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '10px 12px',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 700, color: '#334155',
}
