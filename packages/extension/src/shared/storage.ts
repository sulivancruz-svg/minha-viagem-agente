// Wrapper tipado para chrome.storage.local
// Centraliza todas as leituras/escritas para facilitar auditoria

import type { ExtSettings, Campaign, LeadInfo } from './types'

const KEY = {
  SETTINGS:       'mv_settings',
  UI_OPEN:        'mv_ui_open',
  CAMPAIGNS:      'mv_campaigns',
  CAMPAIGNS_TTL:  'mv_campaigns_ttl',
  LEAD_CACHE:     'mv_lead_cache', // { [phoneE164]: LeadInfo }
} as const

const DEFAULT_SETTINGS: ExtSettings = {
  apiBaseUrl: 'http://localhost:3001',
  apiToken:   '',
}

// Cache de campanhas expira em 5 minutos
const CACHE_TTL_MS = 5 * 60 * 1000

export const Storage = {
  async getSettings(): Promise<ExtSettings> {
    const data = await chrome.storage.local.get(KEY.SETTINGS)
    return { ...DEFAULT_SETTINGS, ...(data[KEY.SETTINGS] ?? {}) }
  },

  async saveSettings(settings: ExtSettings): Promise<void> {
    await chrome.storage.local.set({ [KEY.SETTINGS]: settings })
  },

  async getUiState(): Promise<boolean> {
    const data = await chrome.storage.local.get(KEY.UI_OPEN)
    const value = data[KEY.UI_OPEN]
    return typeof value === 'boolean' ? value : true
  },

  async setUiState(open: boolean): Promise<void> {
    await chrome.storage.local.set({ [KEY.UI_OPEN]: open })
  },

  async getCachedCampaigns(): Promise<Campaign[] | null> {
    const data = await chrome.storage.local.get([KEY.CAMPAIGNS, KEY.CAMPAIGNS_TTL])
    const ttl = (data[KEY.CAMPAIGNS_TTL] as number) ?? 0
    if (Date.now() - ttl > CACHE_TTL_MS) return null
    return (data[KEY.CAMPAIGNS] as Campaign[]) ?? null
  },

  async saveCampaignsCache(campaigns: Campaign[]): Promise<void> {
    await chrome.storage.local.set({
      [KEY.CAMPAIGNS]:     campaigns,
      [KEY.CAMPAIGNS_TTL]: Date.now(),
    })
  },

  async getCachedLead(phoneE164: string): Promise<LeadInfo | null> {
    const data = await chrome.storage.local.get(KEY.LEAD_CACHE)
    const cache = (data[KEY.LEAD_CACHE] as Record<string, LeadInfo>) ?? {}
    return cache[phoneE164] ?? null
  },

  async cacheLeadInfo(phoneE164: string, lead: LeadInfo): Promise<void> {
    const data = await chrome.storage.local.get(KEY.LEAD_CACHE)
    const cache = (data[KEY.LEAD_CACHE] as Record<string, LeadInfo>) ?? {}
    await chrome.storage.local.set({ [KEY.LEAD_CACHE]: { ...cache, [phoneE164]: lead } })
  },

  async clearCampaignsCache(): Promise<void> {
    await chrome.storage.local.remove([KEY.CAMPAIGNS, KEY.CAMPAIGNS_TTL])
  },

  async clearLeadCache(): Promise<void> {
    await chrome.storage.local.remove(KEY.LEAD_CACHE)
  },

  async clearAll(): Promise<void> {
    await chrome.storage.local.clear()
  },
}
