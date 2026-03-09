// Cliente HTTP autenticado para o backend
// Sempre inclui o token salvo no storage

import { Storage } from './storage'
import type {
  Campaign,
  ConversationEventItem,
  Contact,
  ContactListItem,
  Hotel,
  LeadInfo,
  MetricsFunnel,
  MetricsOverview,
  PendingSend,
  Task,
  TaskListItem,
} from './types'

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '')
}

function normalizeAssetUrl(baseUrl: string, assetUrl: string): string {
  const raw = String(assetUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/_mv/')) {
    return `${baseUrl}${raw.replace(/^\/_mv\//, '/api/')}`
  }
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/')) return `${baseUrl}${raw}`
  return `${baseUrl}/${raw}`
}

const REQUEST_TIMEOUT_MS = 12000
const BATCH_SEND_TIMEOUT_MS = 180000

async function getHeaders(): Promise<HeadersInit> {
  const { apiToken } = await Storage.getSettings()
  const token = String(apiToken || '').trim()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const { apiBaseUrl } = await Storage.getSettings()
  const baseUrl = normalizeBaseUrl(apiBaseUrl)
  const headers = await getHeaders()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(`API timeout (${timeoutMs}ms): ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${msg}`)
  }
  return res.json() as Promise<T>
}

export const API = {
  // Health / auth
  ping: () => request<{ ok: boolean }>('/api/health'),
  checkAuth: () => request<{ id: string; email: string }>('/api/auth/me'),

  // Contatos
  getContactByPhone: (phone: string) =>
    request<Contact | null>(`/api/contacts/by-phone/${encodeURIComponent(phone)}`),

  getLeadInfo: (contactId: string) =>
    request<LeadInfo>(`/api/contacts/${contactId}/lead`),

  createContact: (data: { name: string; phoneE164: string; tags: string[]; optInStatus?: 'PENDING' | 'CONFIRMED' | 'BLOCKED' }) =>
    request<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),

  updateStage: (contactId: string, stage: string) =>
    request<void>(`/api/contacts/${contactId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    }),

  blockContact: (contactId: string) =>
    request<void>(`/api/contacts/${contactId}/block`, { method: 'POST' }),

  getContacts: (params: { page?: number; limit?: number; stage?: string; search?: string; optIn?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.stage) query.set('stage', params.stage)
    if (params.search) query.set('search', params.search)
    if (params.optIn) query.set('optIn', params.optIn)
    const q = query.toString()
    return request<{ contacts: ContactListItem[]; total: number; page: number; limit: number }>(
      `/api/contacts${q ? `?${q}` : ''}`,
    )
  },

  // Campanhas
  getCampaigns: async () => {
    const { apiBaseUrl } = await Storage.getSettings()
    const baseUrl = normalizeBaseUrl(apiBaseUrl)
    const campaigns = await request<Campaign[]>('/api/campaigns')
    return campaigns.map(c => ({
      ...c,
      mediaAssets: Array.isArray(c.mediaAssets)
        ? c.mediaAssets.map(url => normalizeAssetUrl(baseUrl, url)).filter(Boolean)
        : [],
    }))
  },
  getHotels: async () => {
    const { apiBaseUrl } = await Storage.getSettings()
    const baseUrl = normalizeBaseUrl(apiBaseUrl)
    const hotels = await request<Hotel[]>('/api/hotels')
    return hotels.map(h => ({
      ...h,
      images: Array.isArray(h.images)
        ? h.images.map(url => normalizeAssetUrl(baseUrl, url)).filter(Boolean)
        : [],
    }))
  },
  getHotel: async (id: string) => {
    const { apiBaseUrl } = await Storage.getSettings()
    const baseUrl = normalizeBaseUrl(apiBaseUrl)
    const hotel = await request<Hotel>(`/api/hotels/${id}`)
    return {
      ...hotel,
      images: Array.isArray(hotel.images)
        ? hotel.images.map(url => normalizeAssetUrl(baseUrl, url)).filter(Boolean)
        : [],
    }
  },
  getHotelsByIds: async (ids: string[]) => {
    const { apiBaseUrl } = await Storage.getSettings()
    const baseUrl = normalizeBaseUrl(apiBaseUrl)
    const uniqueIds = Array.from(new Set(ids.map(v => String(v || '').trim()).filter(Boolean)))
    if (uniqueIds.length === 0) return [] as Hotel[]
    const hotels = await request<Hotel[]>(`/api/hotels?all=true&ids=${encodeURIComponent(uniqueIds.join(','))}`)
    return hotels.map(h => ({
      ...h,
      images: Array.isArray(h.images)
        ? h.images.map(url => normalizeAssetUrl(baseUrl, url)).filter(Boolean)
        : [],
    }))
  },

  // Tarefas
  createTask: (data: { contactId: string; title: string; dueAt?: string }) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),

  completeTask: (taskId: string) =>
    request<void>(`/api/tasks/${taskId}/complete`, { method: 'POST' }),

  getTasks: (params: { done?: boolean; contactId?: string } = {}) => {
    const query = new URLSearchParams()
    if (typeof params.done === 'boolean') query.set('done', String(params.done))
    if (params.contactId) query.set('contactId', params.contactId)
    const q = query.toString()
    return request<TaskListItem[]>(`/api/tasks${q ? `?${q}` : ''}`)
  },

  // Eventos de conversa (auditoria)
  getConversationEvents: (contactId: string, limit = 50) =>
    request<ConversationEventItem[]>(`/api/events?contactId=${encodeURIComponent(contactId)}&limit=${encodeURIComponent(String(limit))}`),

  logEvent: (contactId: string, eventType: string, payload: Record<string, unknown>) =>
    request<void>('/api/events', {
      method: 'POST',
      body: JSON.stringify({ contactId, eventType, payload }),
    }),

  // Envios assistidos
  logAssistedSend: (data: { campaignId?: string; contactId: string; hotelId?: string; notes?: string }) =>
    request<{ id: string }>('/api/sends/assisted', { method: 'POST', body: JSON.stringify(data) }),

  getPendingSends: (days?: number) => {
    const q = days != null ? `?days=${days}` : ''
    return request<PendingSend[]>(`/api/sends/pending${q}`)
  },

  markReplied: (sendId: string) =>
    request<void>(`/api/sends/${sendId}/replied`, { method: 'PATCH' }),

  waWebStatus: () =>
    request<{ ok: boolean; started: boolean; authenticated: boolean; ready: boolean; qrAvailable: boolean; qrDataUrl?: string | null; lastError?: string | null }>(
      '/api/sends/wa-web/status',
    ),

  waWebStart: () =>
    request<{ ok: boolean; started: boolean; authenticated: boolean; ready: boolean; qrAvailable: boolean; qrDataUrl?: string | null; lastError?: string | null }>(
      '/api/sends/wa-web/start',
      { method: 'POST' },
    ),

  batchSendWeb: (data: {
    campaignId?: string
    hotelId?: string
    imageUrl?: string
    imageDataUrl?: string
    items: Array<{ contactId: string; phoneE164: string; text: string }>
  }) =>
    request<{
      ok: boolean
      sent: number
      failed: number
      results: Array<{ contactId: string; success: boolean; sendId?: string; error?: string }>
      error?: string
      started?: boolean
      authenticated?: boolean
      ready?: boolean
      qrAvailable?: boolean
      qrDataUrl?: string | null
      lastError?: string | null
    }>('/api/sends/batch-web', {
      method: 'POST',
      body: JSON.stringify(data),
    }, BATCH_SEND_TIMEOUT_MS),

  // Metricas comerciais
  getMetricsOverview: () => request<MetricsOverview>('/api/metrics/overview'),
  getMetricsFunnel: () => request<MetricsFunnel>('/api/metrics/funnel'),
  getMetricsSends: (params: { campaignId?: string; days?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.campaignId) query.set('campaignId', params.campaignId)
    if (params.days != null) query.set('days', String(params.days))
    const q = query.toString()
    return request<{
      stats: { SENT: number; REPLIED: number; CANCELLED: number }
      rates: { reply: number }
      period: string
    }>(`/api/metrics/sends${q ? `?${q}` : ''}`)
  },

  // Sugestoes de resposta via LLM (backend faz a chamada)
  suggestReply: (params: { lastMessage: string; contactName: string; campaignId?: string }) =>
    request<{ suggestions: string[] }>('/api/ai/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}
