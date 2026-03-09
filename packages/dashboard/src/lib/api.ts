// Cliente HTTP do dashboard para o backend

// Usa URL relativa para passar pelo proxy do Next.js (next.config.js rewrites)
// Prefixo /_mv/ ao inves de /api/ para evitar bloqueio do antivirus
// O Next.js rewrite converte /_mv/* -> backend /api/*
const BASE = ''
const P = '/_mv' // prefixo proxy (reescrito para /api no backend)

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('mv_token') ?? ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${msg}`)
  }
  return res.json()
}

async function upload(path: string, file: File): Promise<{ ok: boolean; mediaUrl: string; filename: string }> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${msg}`)
  }
  return res.json()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; apiToken: string; user: { name: string; email: string } }>(`${P}/auth/login`, {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    }),

  // Overview
  getOverview: () => request<{
    totalContacts: number
    confirmedOptIn: number
    activeCampaigns: number
    sendsToday: number
    sendsWeek: number
    openTasks: number
  }>(`${P}/metrics/overview`),

  // Campanhas
  getCampaigns: () => request<unknown[]>(`${P}/campaigns`),
  getCampaign:  (id: string) => request<unknown>(`${P}/campaigns/${id}`),
  createCampaign: (data: unknown) =>
    request<unknown>(`${P}/campaigns`, { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id: string, data: unknown) =>
    request<unknown>(`${P}/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadCampaignMedia: (file: File) =>
    upload(`${P}/campaigns/upload-media`, file),

  // Contatos
  getContacts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<{ contacts: unknown[]; total: number }>(`${P}/contacts${qs}`)
  },
  importContacts: (rows: unknown[]) =>
    request<{ created: number; skipped: number; errors: number }>(`${P}/contacts/import`, {
      method: 'POST',
      body:   JSON.stringify({ rows }),
    }),
  deleteContact: (id: string) =>
    request<{ ok: boolean }>(`${P}/contacts/${id}`, { method: 'DELETE' }),

  // Envios assistidos
  logAssistedSend: (campaignId: string, contactId: string, notes?: string) =>
    request<unknown>(`${P}/sends/assisted`, {
      method: 'POST',
      body:   JSON.stringify({ campaignId, contactId, notes }),
    }),
  getSendsList: (campaignId?: string) => {
    const qs = campaignId ? `?campaignId=${campaignId}` : ''
    return request<{ sends: unknown[]; total: number }>(`${P}/sends${qs}`)
  },

  // Metricas
  getFunnel:   () => request<{ funnel: Record<string, number>; total: number; conversion: number }>(`${P}/metrics/funnel`),
  getSends:    (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<{ stats: Record<string, number>; rates: Record<string, number> }>(`${P}/metrics/sends${qs}`)
  },
  getTimeline: (days = 14) => request<unknown[]>(`${P}/metrics/timeline?days=${days}`),

  // Tarefas
  getTasks: (contactId?: string) => {
    const qs = contactId ? `?contactId=${contactId}&done=false` : '?done=false'
    return request<unknown[]>(`${P}/tasks${qs}`)
  },

  // ── Hoteis ──────────────────────────────────────────────
  getHotels: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<unknown[]>(`${P}/hotels${qs}`)
  },
  getHotel: (id: string) => request<unknown>(`${P}/hotels/${id}`),
  createHotel: (data: unknown) =>
    request<unknown>(`${P}/hotels`, { method: 'POST', body: JSON.stringify(data) }),
  updateHotel: (id: string, data: unknown) =>
    request<unknown>(`${P}/hotels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteHotel: (id: string) =>
    request<{ ok: boolean }>(`${P}/hotels/${id}`, { method: 'DELETE' }),
  uploadHotelImage: (file: File) =>
    upload(`${P}/hotels/upload-image`, file),

  // ── Envios pendentes ───────────────────────────────────
  getPendingSends: (days = 7) =>
    request<unknown[]>(`${P}/sends/pending?days=${days}`),
  markSendReplied: (id: string) =>
    request<unknown>(`${P}/sends/${id}/replied`, { method: 'PATCH' }),

  // ── Admin SaaS ───────────────────────────────────────────
  adminListUsers: () =>
    request<unknown>(`${P}/admin/users`),

  adminGetUser: (id: string) =>
    request<unknown>(`${P}/admin/users/${id}`),

  adminCreateUser: (data: unknown) =>
    request<unknown>(`${P}/admin/users`, { method: 'POST', body: JSON.stringify(data) }),

  adminUpdateUser: (id: string, data: unknown) =>
    request<unknown>(`${P}/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  adminRotateToken: (id: string) =>
    request<unknown>(`${P}/admin/users/${id}/rotate-token`, { method: 'POST' }),

  adminResetPassword: (id: string, password: string) =>
    request<unknown>(`${P}/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),

  adminDeleteUser: (id: string) =>
    request<{ ok: boolean; deletedUserId: string }>(`${P}/admin/users/${id}`, { method: 'DELETE' }),

  adminUserMetrics: (id: string, days = 30) =>
    request<unknown>(`${P}/admin/users/${id}/metrics?days=${days}`),

  adminUserWaStatus: (id: string) =>
    request<unknown>(`${P}/admin/users/${id}/wa-web/status`),

  adminUserWaStart: (id: string, options?: { forceNew?: boolean }) =>
    request<unknown>(`${P}/admin/users/${id}/wa-web/start`, { method: 'POST', body: JSON.stringify(options ?? {}) }),
}
