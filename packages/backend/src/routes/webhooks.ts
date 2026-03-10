// Webhooks do WhatsApp Business Cloud API
// - GET: verificacao inicial do webhook (handshake Meta)
// - POST: eventos de status e mensagens recebidas

import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyWebhookSignature } from '../lib/whatsapp'

const router = Router()
const prisma = new PrismaClient()

const VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN ?? 'dev-verify-token'
const APP_SECRET   = process.env.WA_APP_SECRET ?? ''

// GET /api/webhooks/whatsapp - verificacao inicial pela Meta
router.get('/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.send(challenge)
  }
  return res.status(403).send('Verify token invalido')
})

// POST /api/webhooks/whatsapp - eventos da Cloud API
router.post('/whatsapp', async (req, res) => {
  // Verifica assinatura HMAC-SHA256 (obrigatorio em producao)
  if (APP_SECRET) {
    const sig = req.headers['x-hub-signature-256'] as string ?? ''
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
    if (!verifyWebhookSignature(raw, sig, APP_SECRET)) {
      return res.status(401).send('Assinatura invalida')
    }
  }

  // Responde imediatamente (requisito da Meta: < 15s)
  res.sendStatus(200)

  // Processa em background
})

// ============================================================
// Processamento dos eventos
// ============================================================

interface WaWebhookBody {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      field: string
      value: {
        messaging_product: string
        metadata: { phone_number_id: string }
        statuses?: WaStatus[]
        messages?: WaMessage[]
      }
    }>
  }>
}

interface WaStatus {
  id:           string  // provider message id
  status:       'sent' | 'delivered' | 'read' | 'failed'
  timestamp:    string
  recipient_id: string
  errors?:      Array<{ code: number; title: string }>
}

interface WaMessage {
  id:        string
  from:      string  // numero sem +
  timestamp: string
  type:      'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'reaction'
  text?:     { body: string }
}

async function processWebhook(body: WaWebhookBody) {
  if (body.object !== 'whatsapp_business_account') return

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const val = change.value

      // Atualiza status de mensagens enviadas
      for (const status of val.statuses ?? []) {
        await handleStatusUpdate(status)
      }

      // Processa mensagens recebidas
      for (const msg of val.messages ?? []) {
        await handleInboundMessage(msg)
      }
    }
  }
}

async function handleStatusUpdate(status: WaStatus) {
  const map: Record<string, string> = {
    sent:      'SENT',
    delivered: 'DELIVERED',
    read:      'READ',
    failed:    'FAILED',
  }
  const newStatus = map[status.status]
  if (!newStatus) return

  // Schema atual nao tem providerMessageId/deliveredAt/readAt/lastError.
  // Mantemos log de diagnostico sem quebrar o processamento.
  console.log('[WhatsApp Status Update]', {
    providerMessageId: status.id,
    status: newStatus,
    recipientId: status.recipient_id,
  })
}

async function handleInboundMessage(msg: WaMessage) {
  const phone = `+${msg.from}`
  const text  = msg.type === 'text' ? (msg.text?.body ?? '') : `[${msg.type}]`

  // Encontra o contato pelo telefone
  let contact = await prisma.contact.findUnique({ where: { phoneE164: phone } })

  // Se nao existe, cria como lead novo (sem opt-in ainda)
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        name:        phone, // sera atualizado manualmente
        phoneE164:   phone,
        optInStatus: 'PENDING',
        optInSource: 'inbound_message',
      },
    })
    await prisma.leadStage.create({ data: { contactId: contact.id } })
  }

  // Detecta opt-out por palavra-chave
  const isOptOut = /\b(sair|stop|parar|remover|nao quero|cancelar)\b/i.test(text)
  if (isOptOut) {
    await prisma.contact.update({
      where: { id: contact.id },
      data:  { blocked: true, blockedAt: new Date(), optInStatus: 'BLOCKED' },
    })
    await prisma.leadStage.upsert({
      where:  { contactId: contact.id },
      update: { stage: 'OPTED_OUT' },
      create: { contactId: contact.id, stage: 'OPTED_OUT' },
    })
    await prisma.conversationEvent.create({
      data: {
        contactId: contact.id,
        type: 'OPT_OUT',
        payload: JSON.stringify({ source: 'keyword', message: text }),
      },
    })
    return
  }

  // Detecta opt-in por palavra-chave (confirma consentimento)
  const isOptIn = /\b(sim|aceito|quero|ok|confirmo)\b/i.test(text) && contact.optInStatus === 'PENDING'
  if (isOptIn) {
    await prisma.contact.update({
      where: { id: contact.id },
      data:  { optInStatus: 'CONFIRMED', optInTimestamp: new Date(), optInSource: 'whatsapp_reply' },
    })
    await prisma.conversationEvent.create({
      data: {
        contactId: contact.id,
        type: 'OPT_IN',
        payload: JSON.stringify({ source: 'keyword_reply', message: text }),
      },
    })
  }

  // Registra evento de mensagem recebida
  await prisma.conversationEvent.create({
    data: {
      contactId: contact.id,
      type: 'INBOUND',
      payload: JSON.stringify({
        messageId: msg.id,
        text,
        timestamp: msg.timestamp,
      }),
    },
  })

  // Atualiza estagio se e primeira resposta
  const stage = await prisma.leadStage.findUnique({ where: { contactId: contact.id } })
  if (stage?.stage === 'NEW') {
    await prisma.leadStage.update({
      where: { contactId: contact.id },
      data:  { stage: 'CONTACTED' },
    })
  }

  // Detecta interesse em cotacao e atualiza estagio
  const isCotacao = /\b(cotar?|preco|valor|quanto|orcamento|parcela)\b/i.test(text)
  if (isCotacao && stage?.stage !== 'QUOTE_REQUESTED') {
    await prisma.leadStage.upsert({
      where:  { contactId: contact.id },
      update: { stage: 'QUOTE_REQUESTED' },
      create: { contactId: contact.id, stage: 'QUOTE_REQUESTED' },
    })
  }

  // Marca respostas nos envios de campanha pendentes
  await prisma.campaignSend.updateMany({
    where: {
      contactId: contact.id,
      status:    { in: ['SENT', 'DELIVERED', 'READ'] },
      repliedAt: null,
    },
    data: { repliedAt: new Date(), status: 'REPLIED' },
  })
}
