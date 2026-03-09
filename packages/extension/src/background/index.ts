// ==========================================================
// Service Worker MV3 - roda em segundo plano
// Gerencia auth, comunica com o backend, sincroniza dados
// Nao tem acesso ao DOM
// ==========================================================

import { Storage } from '../shared/storage'
import { API } from '../shared/api'
import type { ExtMessage, Campaign, Hotel } from '../shared/types'

const HOTEL_CACHE_TTL_MS = 5 * 60 * 1000
const MESSAGE_TIMEOUT_MS = 180000
let hotelsCache: { at: number; hotels: Hotel[] } | null = null
const hotelByIdCache = new Map<string, { at: number; hotel: Hotel }>()

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '')
}

// ----- Listener principal: recebe mensagens dos content scripts e popup -----
chrome.runtime.onMessage.addListener(
  (msg: ExtMessage, _sender, sendResponse) => {
    let responded = false
    const safeRespond = (payload: unknown) => {
      if (responded) return
      responded = true
      try {
        sendResponse(payload)
      } catch {
        // canal pode ter fechado; evita throw não tratado
      }
    }

    const timeoutId = setTimeout(() => {
      safeRespond({ ok: false, error: 'BACKGROUND_TIMEOUT' })
    }, MESSAGE_TIMEOUT_MS)

    ;(async () => {
      try {
        const response = await handleMessage(msg)
        clearTimeout(timeoutId)
        safeRespond(response ?? { ok: false, error: 'EMPTY_RESPONSE' })
      } catch (err) {
        clearTimeout(timeoutId)
        safeRespond({ ok: false, error: String((err as Error)?.message ?? err) })
      }
    })()

    return true // indica resposta assincrona
  },
)

async function handleMessage(msg: ExtMessage): Promise<unknown> {
  switch (msg.type) {

    // --- Busca dados do lead pelo telefone ---
    case 'GET_LEAD': {
      // Tenta cache local primeiro (evita latencia de rede)
      const cached = await Storage.getCachedLead(msg.phoneE164)
      if (cached) return { type: 'GET_LEAD_RESPONSE', lead: cached }

      try {
        const contact = await API.getContactByPhone(msg.phoneE164)
        if (!contact) return { type: 'GET_LEAD_RESPONSE', lead: null }
        const lead = await API.getLeadInfo(contact.id)
        await Storage.cacheLeadInfo(msg.phoneE164, lead)
        return { type: 'GET_LEAD_RESPONSE', lead }
      } catch (err) {
        return { type: 'GET_LEAD_RESPONSE', lead: null }
      }
    }

    case 'GET_CONTACT_BY_PHONE': {
      try {
        const contact = await API.getContactByPhone(msg.phoneE164)
        return { type: 'GET_CONTACT_BY_PHONE_RESPONSE', contact }
      } catch (err) {
        return { type: 'GET_CONTACT_BY_PHONE_RESPONSE', contact: null, error: String(err) }
      }
    }

    // --- Cria contato pelo painel da extensao ---
    case 'CREATE_CONTACT': {
      try {
        const created = await API.createContact({
          name: msg.name,
          phoneE164: msg.phoneE164,
          tags: [],
          // Backend atual nao aceita UNKNOWN; usamos PENDING como estado inicial.
          optInStatus: 'PENDING',
        })
        await Storage.clearLeadCache()
        return { type: 'CREATE_CONTACT_RESPONSE', ok: true, contactId: created.id }
      } catch (err) {
        return { type: 'CREATE_CONTACT_RESPONSE', ok: false, error: String(err) }
      }
    }

    // --- Lista campanhas ativas (com cache) ---
    case 'GET_CAMPAIGNS': {
      try {
        const campaigns: Campaign[] = await API.getCampaigns()
        await Storage.saveCampaignsCache(campaigns)
        return { type: 'GET_CAMPAIGNS_RESPONSE', campaigns }
      } catch (err) {
        const cached = await Storage.getCachedCampaigns()
        return { type: 'GET_CAMPAIGNS_RESPONSE', campaigns: cached ?? [] }
      }
    }

    case 'GET_HOTELS': {
      try {
        const hotels = await API.getHotels()
        hotelsCache = { at: Date.now(), hotels }
        for (const hotel of hotels) {
          hotelByIdCache.set(hotel.id, { at: Date.now(), hotel })
        }
        return { type: 'GET_HOTELS_RESPONSE', hotels }
      } catch (err) {
        const hotels = await getHotelsCached()
        return { type: 'GET_HOTELS_RESPONSE', hotels }
      }
    }

    case 'GET_HOTEL': {
      const hotel = await getHotelCached(msg.id)
      return { type: 'GET_HOTEL_RESPONSE', hotel }
    }

    case 'GET_CONTACTS': {
      const data = await API.getContacts({
        page: msg.page,
        limit: msg.limit,
        stage: msg.stage,
        search: msg.search,
        optIn: msg.optIn,
      })
      return { type: 'GET_CONTACTS_RESPONSE', ...data }
    }

    case 'GET_TASKS': {
      const tasks = await API.getTasks({
        done: msg.done,
        contactId: msg.contactId,
      })
      return { type: 'GET_TASKS_RESPONSE', tasks }
    }

    case 'GET_METRICS_OVERVIEW': {
      const overview = await API.getMetricsOverview()
      return { type: 'GET_METRICS_OVERVIEW_RESPONSE', overview }
    }

    case 'GET_METRICS_FUNNEL': {
      const funnel = await API.getMetricsFunnel()
      return { type: 'GET_METRICS_FUNNEL_RESPONSE', funnel }
    }

    case 'GET_METRICS_SENDS': {
      try {
        const sendsMetrics = await API.getMetricsSends({
          campaignId: msg.campaignId,
          days: msg.days,
        })
        return { type: 'GET_METRICS_SENDS_RESPONSE', ok: true, sendsMetrics, campaignId: msg.campaignId }
      } catch (err) {
        return {
          type: 'GET_METRICS_SENDS_RESPONSE',
          ok: false,
          campaignId: msg.campaignId,
          error: String(err),
          sendsMetrics: {
            stats: { SENT: 0, REPLIED: 0, CANCELLED: 0 },
            rates: { reply: 0 },
            period: `${msg.days ?? 30} dias`,
          },
        }
      }
    }

    // --- Atualiza estagio do lead ---
    case 'UPDATE_STAGE': {
      await API.updateStage(msg.contactId, msg.stage)
      await Storage.clearLeadCache() // invalida cache
      return { ok: true }
    }

    // --- Cria tarefa de follow-up ---
    case 'CREATE_TASK': {
      const task = await API.createTask({
        contactId: msg.contactId,
        title:     msg.title,
        dueAt:     msg.dueAt,
      })
      return { ok: true, task }
    }

    // --- Conclui tarefa ---
    case 'COMPLETE_TASK': {
      await API.completeTask(msg.taskId)
      return { ok: true }
    }

    // --- Registra evento de conversa para auditoria ---
    case 'LOG_EVENT': {
      try {
        await API.logEvent(msg.contactId, msg.eventType, msg.payload)
      } catch {
        // evento de auditoria nao deve bloquear o fluxo
      }
      return { ok: true }
    }

    // --- Sugestao de resposta via LLM ---
    case 'SUGGEST_REPLY': {
      try {
        const { suggestions } = await API.suggestReply({
          lastMessage:  msg.lastMessage,
          contactName:  msg.contactName,
          campaignId:   msg.campaignId,
        })
        return { type: 'SUGGEST_REPLY_RESPONSE', suggestions }
      } catch {
        return { type: 'SUGGEST_REPLY_RESPONSE', suggestions: [] }
      }
    }

    // --- Registra envio assistido ---
    case 'LOG_ASSISTED_SEND': {
      try {
        const send = await API.logAssistedSend({
          campaignId: msg.campaignId,
          contactId:  msg.contactId,
          hotelId:    msg.hotelId,
          notes:      msg.notes,
        })
        return { type: 'LOG_ASSISTED_SEND_RESPONSE', ok: true, sendId: (send as { id: string }).id }
      } catch (err) {
        return { type: 'LOG_ASSISTED_SEND_RESPONSE', ok: false, error: String(err) }
      }
    }

    case 'GET_CONTACT_EVENTS': {
      try {
        const events = await API.getConversationEvents(msg.contactId, msg.limit ?? 50)
        return { type: 'GET_CONTACT_EVENTS_RESPONSE', ok: true, events }
      } catch (err) {
        return { type: 'GET_CONTACT_EVENTS_RESPONSE', ok: false, events: [], error: String(err) }
      }
    }

    // --- Fila de respostas pendentes ---
    case 'GET_PENDING_SENDS': {
      try {
        const sends = await API.getPendingSends(msg.days)
        return { type: 'GET_PENDING_SENDS_RESPONSE', ok: true, sends }
      } catch (err) {
        return { type: 'GET_PENDING_SENDS_RESPONSE', ok: false, sends: [], error: String(err) }
      }
    }

    // --- Marca envio como respondido ---
    case 'MARK_REPLIED': {
      try {
        await API.markReplied(msg.sendId)
        return { type: 'MARK_REPLIED_RESPONSE', ok: true }
      } catch (err) {
        return { type: 'MARK_REPLIED_RESPONSE', ok: false, error: String(err) }
      }
    }

    case 'BATCH_SEND_TEXT': {
      try {
        const data = await API.batchSendWeb({
          campaignId: msg.campaignId,
          hotelId: msg.hotelId,
          imageUrl: msg.imageUrl,
          imageDataUrl: msg.imageDataUrl,
          items: msg.items,
        })
        return {
          type: 'BATCH_SEND_TEXT_RESPONSE',
          ok: data.ok,
          sent: data.sent,
          failed: data.failed,
          results: data.results,
          ready: data.ready,
          qrDataUrl: data.qrDataUrl ?? null,
          error: data.error,
        }
      } catch (err) {
        return {
          type: 'BATCH_SEND_TEXT_RESPONSE',
          ok: false,
          sent: 0,
          failed: msg.items.length,
          results: [],
          error: String(err),
        }
      }
    }

    // --- Login via background (evita bloqueio do antivirus no popup) ---
    case 'LOGIN': {
      const { apiBaseUrl } = await Storage.getSettings()
      const baseUrl = normalizeBaseUrl(msg.apiBaseUrl ?? apiBaseUrl)
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: msg.email, password: msg.password }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        return { ok: false, error: errText || `HTTP ${res.status}` }
      }
      const data = await res.json() as { token?: string; apiToken?: string; user?: unknown }
      const loginToken = String(data.apiToken ?? data.token ?? '').trim()
      if (!loginToken) return { ok: false, error: 'Token de autenticacao nao retornado' }
      // Salva token e URL + limpa caches antigos para forcar reload com novo token
      const newSettings = { apiBaseUrl: baseUrl, apiToken: loginToken }
      await Storage.clearCampaignsCache()
      await Storage.clearLeadCache()
      hotelsCache = null
      hotelByIdCache.clear()
      await Storage.saveSettings(newSettings)
      const auth = await checkAuthDetailed()
      return { ok: true, authenticated: auth.authenticated, error: auth.error, token: loginToken, settings: newSettings }
    }

    // --- Configuracoes ---
    case 'GET_SETTINGS': {
      const settings = await Storage.getSettings()
      return { type: 'GET_SETTINGS_RESPONSE', settings }
    }

    case 'SAVE_SETTINGS': {
      const nextSettings = {
        apiBaseUrl: normalizeBaseUrl(msg.settings.apiBaseUrl),
        apiToken: String(msg.settings.apiToken || '').trim(),
      }
      await Storage.saveSettings(nextSettings)
      hotelsCache = null
      hotelByIdCache.clear()
      const auth = await checkAuthDetailed()
      return { type: 'PONG', authenticated: auth.authenticated, error: auth.error }
    }

    case 'PING': {
      const auth = await checkAuthDetailed()
      return { type: 'PONG', authenticated: auth.authenticated, error: auth.error }
    }

    default:
      return { ok: false, error: 'UNKNOWN_MESSAGE' }
  }
}

function isFresh(timestamp: number, ttlMs = HOTEL_CACHE_TTL_MS): boolean {
  return Date.now() - timestamp < ttlMs
}

async function getHotelsCached(): Promise<Hotel[]> {
  if (hotelsCache && isFresh(hotelsCache.at)) return hotelsCache.hotels
  try {
    const hotels = await API.getHotels()
    hotelsCache = { at: Date.now(), hotels }
    for (const hotel of hotels) {
      hotelByIdCache.set(hotel.id, { at: Date.now(), hotel })
    }
    return hotels
  } catch (err) {
    return hotelsCache?.hotels ?? []
  }
}

async function getHotelCached(id: string): Promise<Hotel | null> {
  const key = String(id || '').trim()
  if (!key) return null
  const fromMap = hotelByIdCache.get(key)
  if (fromMap && isFresh(fromMap.at)) return fromMap.hotel

  const list = await getHotelsCached()
  const fromList = list.find(h => h.id === key) ?? null
  if (fromList) {
    hotelByIdCache.set(key, { at: Date.now(), hotel: fromList })
    return fromList
  }

  try {
    const hotel = await API.getHotel(key)
    hotelByIdCache.set(key, { at: Date.now(), hotel })
    return hotel
  } catch {
    return null
  }
}

async function checkAuthDetailed(): Promise<{ authenticated: boolean; error?: string }> {
  try {
    await API.checkAuth()
    return { authenticated: true }
  } catch (err) {
    const message = String((err as Error)?.message ?? err ?? 'Falha de autenticacao')
    return { authenticated: false, error: message }
  }
}

// ----- Alarme para sincronizar campanhas periodicamente -----
chrome.alarms.create('sync-campaigns', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'sync-campaigns') return
  try {
    const campaigns = await API.getCampaigns()
    await Storage.saveCampaignsCache(campaigns)
  } catch {
    // silencioso: tenta na proxima execucao
  }
})

// ----- Instalacao: abre popup de configuracao -----
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs
      .create({ url: chrome.runtime.getURL('src/popup/index.html') })
      .catch(() => {
        // Nao quebra o service worker se a abertura falhar.
      })
  }
})
