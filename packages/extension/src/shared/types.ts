// ============================================================
// Tipos compartilhados entre background, content script e popup
// ============================================================

export type OptInStatus = 'PENDING' | 'CONFIRMED' | 'BLOCKED'

export type LeadStageType =
  | 'NEW'
  | 'CONTACTED'
  | 'QUOTE_REQUESTED'
  | 'PROPOSAL_SENT'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'OPTED_OUT'

export type SendStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED'
  | 'REPLIED'

export interface PendingSend {
  id: string
  campaignId: string
  contactId: string
  status: SendStatus
  sentAt: string
  repliedAt?: string | null
  contact: { id: string; name: string; phoneE164: string } | null
  campaign: { id: string; name: string } | null
}

// --- Entidades espelhadas do backend ---

export interface Contact {
  id: string
  name: string
  phoneE164: string
  tags: string[]
  optInStatus: OptInStatus
  optInSource?: string
  optInTimestamp?: string
  blocked: boolean
  createdAt: string
}

export interface Campaign {
  id: string
  name: string
  destination: string
  dateRange: string
  offerText: string
  inclusions: string[]
  hotels?: string[]    // compat: legado (nomes) ou ids
  hotelIds?: string[]  // novo formato explicito
  priceFrom?: number
  ctaText: string
  landingUrl?: string
  mediaAssets: string[]
  templateName?: string
  isActive: boolean
  createdAt: string
}

export interface Hotel {
  id: string
  name: string
  destination: string
  stars?: number | null
  description?: string | null
  highlights: string[]
  priceFrom?: number | null
  images: string[]
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface Task {
  id: string
  contactId: string
  title: string
  dueAt?: string
  done: boolean
}

export interface TaskListItem extends Task {
  doneAt?: string | null
  contact?: { name: string; phoneE164: string }
}

export interface MetricsOverview {
  totalContacts: number
  confirmedOptIn: number
  activeCampaigns: number
  sendsToday: number
  sendsWeek: number
  openTasks: number
}

export interface MetricsFunnel {
  funnel: Record<LeadStageType, number>
  total: number
  conversion: number
}

export interface MetricsSends {
  stats: {
    SENT: number
    REPLIED: number
    CANCELLED: number
  }
  rates: {
    reply: number
  }
  period: string
}

export interface ContactListItem {
  id: string
  name: string
  phoneE164: string
  tags: string[] | string
  optInStatus: OptInStatus
  blocked: boolean
  createdAt: string
  updatedAt?: string
  leadStage?: { stage: LeadStageType } | null
}

export interface LeadInfo {
  contactId: string
  contactName: string
  phoneE164: string
  stage: LeadStageType
  tags: string[]
  notes?: string
  lastInteraction?: string
  campaigns: Array<{ name: string; sentAt: string; status: SendStatus }>
  tasks: Task[]
}

export interface ConversationEventItem {
  id: string
  contactId: string
  type: string
  payload: string
  createdAt: string
}

// --- Chat detectado no WhatsApp Web ---

export interface DetectedChat {
  name: string
  phoneE164?: string | null  // nem sempre disponivel sem abrir o contato
  rawPhone?: string
  lastMessage?: string
}

export type CurrentChatState =
  | { type: 'CHAT'; chat: DetectedChat }
  | { type: 'CHAT_NO_JID'; name: string }
  | { type: 'VIEW_PROFILE'; name: string }

// --- Configuracoes salvas no storage da extensao ---

export interface ExtSettings {
  apiBaseUrl: string
  apiToken: string
  agentName?: string
  defaultCampaignId?: string
}

// --- Mensagens trocadas entre scripts via chrome.runtime.sendMessage ---

export type ExtMessage =
  | { type: 'GET_LEAD';               phoneE164: string }
  | { type: 'GET_LEAD_RESPONSE';      lead: LeadInfo | null }
  | { type: 'GET_CONTACT_BY_PHONE';   phoneE164: string }
  | { type: 'GET_CONTACT_BY_PHONE_RESPONSE'; contact: Contact | null; error?: string }
  | { type: 'CREATE_CONTACT';         name: string; phoneE164: string }
  | { type: 'CREATE_CONTACT_RESPONSE'; ok: boolean; contactId?: string; error?: string }
  | { type: 'GET_CAMPAIGNS' }
  | { type: 'GET_CAMPAIGNS_RESPONSE'; campaigns: Campaign[] }
  | { type: 'GET_HOTELS' }
  | { type: 'GET_HOTELS_RESPONSE'; hotels: Hotel[] }
  | { type: 'GET_HOTEL'; id: string }
  | { type: 'GET_HOTEL_RESPONSE'; hotel: Hotel | null }
  | { type: 'GET_CONTACTS';           page?: number; limit?: number; stage?: LeadStageType; search?: string; optIn?: OptInStatus }
  | { type: 'GET_CONTACTS_RESPONSE';  contacts: ContactListItem[]; total: number; page: number; limit: number }
  | { type: 'GET_TASKS';              done?: boolean; contactId?: string }
  | { type: 'GET_TASKS_RESPONSE';     tasks: TaskListItem[] }
  | { type: 'GET_METRICS_OVERVIEW' }
  | { type: 'GET_METRICS_OVERVIEW_RESPONSE'; overview: MetricsOverview }
  | { type: 'GET_METRICS_FUNNEL' }
  | { type: 'GET_METRICS_FUNNEL_RESPONSE'; funnel: MetricsFunnel }
  | { type: 'GET_METRICS_SENDS'; campaignId?: string; days?: number }
  | { type: 'GET_METRICS_SENDS_RESPONSE'; sendsMetrics: MetricsSends; campaignId?: string; ok?: boolean; error?: string }
  | { type: 'UPDATE_STAGE';           contactId: string; stage: LeadStageType }
  | { type: 'CREATE_TASK';            contactId: string; title: string; dueAt?: string }
  | { type: 'COMPLETE_TASK';          taskId: string }
  | { type: 'LOG_EVENT';              contactId: string; eventType: string; payload: Record<string, unknown> }
  | { type: 'GET_CONTACT_EVENTS';     contactId: string; limit?: number }
  | { type: 'GET_CONTACT_EVENTS_RESPONSE'; events: ConversationEventItem[]; ok?: boolean; error?: string }
  | { type: 'SUGGEST_REPLY';          lastMessage: string; contactName: string; campaignId?: string }
  | { type: 'SUGGEST_REPLY_RESPONSE'; suggestions: string[] }
  | { type: 'LOG_ASSISTED_SEND';      campaignId?: string; contactId: string; hotelId?: string; notes?: string }
  | { type: 'LOG_ASSISTED_SEND_RESPONSE'; ok: boolean; sendId?: string; error?: string }
  | { type: 'GET_PENDING_SENDS';      days?: number }
  | { type: 'GET_PENDING_SENDS_RESPONSE'; sends: PendingSend[]; ok?: boolean; error?: string }
  | { type: 'MARK_REPLIED';           sendId: string }
  | { type: 'MARK_REPLIED_RESPONSE';  ok: boolean; error?: string }
  | {
      type: 'BATCH_SEND_TEXT'
      campaignId?: string
      hotelId?: string
      imageUrl?: string
      imageDataUrl?: string
      items: Array<{ contactId: string; phoneE164: string; text: string }>
    }
  | {
      type: 'BATCH_SEND_TEXT_RESPONSE'
      ok: boolean
      sent: number
      failed: number
      results: Array<{ contactId: string; success: boolean; sendId?: string; error?: string }>
      error?: string
      ready?: boolean
      qrDataUrl?: string | null
    }
  | { type: 'GET_SETTINGS' }
  | { type: 'GET_SETTINGS_RESPONSE';  settings: ExtSettings }
  | { type: 'SAVE_SETTINGS';          settings: ExtSettings }
  | { type: 'LOGIN';                  apiBaseUrl: string; email: string; password: string }
  | { type: 'PING' }
  | { type: 'PONG';                   authenticated: boolean; error?: string }
