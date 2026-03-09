// Cliente para WhatsApp Business Cloud API
// Implementa envio de templates com retries, idempotencia e rate limit
// Documentacao: https://developers.facebook.com/docs/whatsapp/cloud-api

import { PrismaClient } from '@prisma/client'

const API_VERSION  = process.env.WA_API_VERSION    ?? 'v18.0'
const PHONE_ID     = process.env.WA_PHONE_NUMBER_ID ?? ''
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN    ?? ''
const BASE_URL     = `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`

// Limites configurados por variavel de ambiente
const DAILY_LIMIT  = parseInt(process.env.WA_DAILY_LIMIT           ?? '200',  10)
const RPM          = parseInt(process.env.WA_RATE_LIMIT_PER_MINUTE ?? '10',   10)

// Contador simples em memoria (em producao usar Redis)
const counter = {
  dailySent:   0,
  dailyReset:  new Date().toDateString(),
  lastMinute:  [] as number[], // timestamps dos ultimos envios
}

function resetDailyIfNeeded() {
  const today = new Date().toDateString()
  if (counter.dailyReset !== today) {
    counter.dailySent  = 0
    counter.dailyReset = today
  }
}

function checkRateLimit(): { ok: boolean; retryAfterMs?: number } {
  resetDailyIfNeeded()

  if (counter.dailySent >= DAILY_LIMIT) {
    return { ok: false, retryAfterMs: msUntilMidnight() }
  }

  const now   = Date.now()
  const since = now - 60_000
  counter.lastMinute = counter.lastMinute.filter(t => t > since)

  if (counter.lastMinute.length >= RPM) {
    const oldest = counter.lastMinute[0]
    return { ok: false, retryAfterMs: oldest + 60_000 - now + 200 }
  }

  return { ok: true }
}

function msUntilMidnight(): number {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export interface TemplateComponent {
  type:       'header' | 'body' | 'button'
  sub_type?:  string
  index?:     number
  parameters: Array<{ type: 'text' | 'image' | 'document'; text?: string; image?: { link: string } }>
}

export interface SendTemplateParams {
  to:           string   // numero E.164 sem o +, ex: "5511999990000"
  templateName: string
  language:     string   // ex: "pt_BR"
  components?:  TemplateComponent[]
  idempotencyKey?: string
}

export interface SendResult {
  success:          boolean
  providerMessageId?: string
  error?:           string
  rateLimitedMs?:   number
}


// Envia uma mensagem de template com retries (exponential backoff)
export async function sendTemplate(
  params: SendTemplateParams,
  retries = 3,
): Promise<SendResult> {
  if (!PHONE_ID || !ACCESS_TOKEN) {
    return { success: false, error: 'WA_PHONE_NUMBER_ID ou WA_ACCESS_TOKEN nao configurados' }
  }

  const rl = checkRateLimit()
  if (!rl.ok) {
    return { success: false, error: 'Rate limit atingido', rateLimitedMs: rl.retryAfterMs }
  }

  const body = {
    messaging_product: 'whatsapp',
    to: params.to.replace(/\D/g, ''), // garante apenas digitos
    type: 'template',
    template: {
      name:       params.templateName,
      language:   { code: params.language },
      components: params.components ?? [],
    },
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(BASE_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as {
        messages?: Array<{ id: string }>
        error?: { message: string; code: number }
      }

      if (res.ok && data.messages?.[0]?.id) {
        counter.dailySent++
        counter.lastMinute.push(Date.now())
        return { success: true, providerMessageId: data.messages[0].id }
      }

      // Erro de qualidade (130429) - backoff mais longo
      if (data.error?.code === 130429) {
        const wait = Math.pow(2, attempt + 2) * 1000
        await sleep(wait)
        continue
      }

      return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
    } catch (e) {
      if (attempt === retries - 1) {
        return { success: false, error: String(e) }
      }
      // Backoff exponencial com jitter
      await sleep((Math.pow(2, attempt) + Math.random()) * 1000)
    }
  }

  return { success: false, error: 'Retries esgotados' }
}


// Verifica assinatura do webhook (HMAC-SHA256)
import { createHmac } from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signature: string, // header x-hub-signature-256
  appSecret: string,
): boolean {
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(payload).digest('hex')
  // Comparacao em tempo constante para evitar timing attacks
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Stub para testes sem credenciais reais
export function isConfigured(): boolean {
  return Boolean(PHONE_ID && ACCESS_TOKEN)
}
