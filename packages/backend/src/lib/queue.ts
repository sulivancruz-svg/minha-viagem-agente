// Fila de envio com rate limit, jitter e retries
// MVP: fila em memoria. Producao: substituir por BullMQ + Redis.

import { PrismaClient } from '@prisma/client'
import { sendTemplate } from './whatsapp'

const prisma = new PrismaClient()

interface QueueItem {
  sendId:       string
  campaignId:   string
  contactId:    string
  phoneE164:    string
  templateName: string
  language:     string
  components:   unknown[]
  attempts:     number
}

// Fila em memoria com persistencia de status no banco
const queue: QueueItem[] = []
let running = false

const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 3000 // 3 segundos entre envios

function jitter(base: number): number {
  return base + Math.floor(Math.random() * base * 0.4)
}

// Adiciona itens a fila e inicia processamento
export async function enqueueTemplatesSend(
  campaignId: string,
  contacts: Array<{ id: string; phoneE164: string }>,
  templateName: string,
  language:     string,
  buildComponents: (phoneE164: string) => unknown[],
): Promise<number> {
  for (const c of contacts) {
    // Cria ou atualiza registro de envio no banco
    // Busca envio existente para esta campanha+contato ou cria novo
    const existingSend = await prisma.campaignSend.findFirst({
      where: { campaignId, contactId: c.id },
    })
    const send = existingSend
      ? await prisma.campaignSend.update({ where: { id: existingSend.id }, data: { status: 'QUEUED' } })
      : await prisma.campaignSend.create({ data: { campaignId, contactId: c.id, status: 'QUEUED' } })

    queue.push({
      sendId:       send.id,
      campaignId,
      contactId:    c.id,
      phoneE164:    c.phoneE164,
      templateName,
      language,
      components:   buildComponents(c.phoneE164),
      attempts:     0,
    })
  }

  if (!running) processQueue()
  return queue.length
}

async function processQueue() {
  running = true

  while (queue.length > 0) {
    const item = queue.shift()!
    await processSingleItem(item)
    // Aguarda entre envios (rate limit + jitter)
    await sleep(jitter(BASE_DELAY_MS))
  }

  running = false
}

async function processSingleItem(item: QueueItem) {
  try {
    const result = await sendTemplate({
      to:           item.phoneE164.replace('+', ''),
      templateName: item.templateName,
      language:     item.language,
      components:   item.components as never,
    })

    if (result.success) {
      await prisma.campaignSend.update({
        where: { id: item.sendId },
        data:  {
          status: 'SENT',
          sentAt: new Date(),
          notes: result.providerMessageId ? `providerMessageId:${result.providerMessageId}` : undefined,
        },
      })
    } else if (result.rateLimitedMs) {
      // Rate limit: recoloca na fila e espera
      item.attempts++
      queue.unshift(item) // volta para o inicio
      await sleep(result.rateLimitedMs)
    } else {
      item.attempts++
      if (item.attempts < MAX_ATTEMPTS) {
        queue.push(item) // tenta novamente mais tarde
        await prisma.campaignSend.update({
          where: { id: item.sendId },
          data:  { notes: result.error ?? null, status: 'QUEUED' },
        })
      } else {
        await prisma.campaignSend.update({
          where: { id: item.sendId },
          data:  { status: 'CANCELLED', notes: result.error ?? null },
        })
      }
    }
  } catch (e) {
    await prisma.campaignSend.update({
      where: { id: item.sendId },
      data:  { status: 'CANCELLED', notes: String(e) },
    }).catch(() => {})
  }
}

export function getQueueSize(): number {
  return queue.length
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
