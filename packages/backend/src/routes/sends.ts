// Rota de envios assistidos - Minha Viagem Agente de Vendas
// Envio 100% assistido: a extensão preenche a caixa, o agente clica Enviar manualmente

import { type Request, Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import {
  waWebSendMedia,
  waWebSendText,
  waWebStart,
  waWebStatus,
  waWebPrepareMedia,
  waWebSendPreparedMedia,
  waWebCleanupTempFile,
} from '../lib/waWeb'

const router = Router()
const prisma = new PrismaClient()
const WA_WEB_READY_WAIT_MS = 20_000
const WA_WEB_READY_POLL_MS = 1_000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function waitForWaWebReady(userId: string, timeoutMs = WA_WEB_READY_WAIT_MS): Promise<ReturnType<typeof waWebStatus>> {
  const deadline = Date.now() + timeoutMs
  let status = waWebStatus(userId)

  while (!status.ready && Date.now() < deadline) {
    await sleep(WA_WEB_READY_POLL_MS)
    status = waWebStatus(userId)
  }

  return status
}

const BatchWebSchema = z.object({
  campaignId: z.string().optional(),
  hotelId: z.string().optional(),
  imageUrl: z.string().trim().min(1).optional(),
  imageDataUrl: z.string().trim().min(1).optional(),
  items: z.array(z.object({
    contactId: z.string(),
    phoneE164: z.string().min(8),
    text: z.string().min(1).max(4096),
  })).min(1).max(10),
})

function normalizeMediaUrl(rawValue: string | undefined, req: Request): string | null {
  const rawInput = String(rawValue || '').trim()
  const raw = rawInput.startsWith('/_mv/')
    ? rawInput.replace(/^\/_mv\//, '/api/')
    : rawInput
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`

  const host = String(req.get?.('host') || '').trim()
  const protocol = String(req.protocol || 'http').trim() || 'http'
  if (!host) return null
  if (raw.startsWith('/')) return `${protocol}://${host}${raw}`
  return `${protocol}://${host}/${raw.replace(/^\/+/, '')}`
}

/**
 * Remove "Imagem da oferta: https://..." line from caption text.
 * When media is attached, this URL is redundant and would appear as plain text.
 */
function stripImageUrlFromCaption(text: string, hasMedia: boolean): string {
  if (!hasMedia) return text
  return text
    .replace(/\n?\n?Imagem da oferta:\s*https?:\/\/\S+\n?/gi, '')
    .replace(/\n?\n?Imagem da oferta:\s*data:image\/\S+\n?/gi, '')
    .trim()
}

// GET /api/sends?campaignId=...&page=1
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { campaignId, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: Record<string, unknown> = {}
    if (campaignId) where.campaignId = campaignId

    const [sends, total] = await Promise.all([
      prisma.campaignSend.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { sentAt: 'desc' },
        include: {
          contact:  { select: { name: true, phoneE164: true } },
          campaign: { select: { name: true } },
          user:     { select: { name: true } },
        },
      }),
      prisma.campaignSend.count({ where }),
    ])

    return res.json({ sends, total })
  } catch (e) { next(e) }
})

// GET /api/sends/pending?days=7
// Retorna envios com status=SENT dos ultimos N dias (para fila de respostas)
router.get('/pending', requireAuth, async (req, res, next) => {
  try {
    const days = parseInt((req.query as Record<string, string>).days ?? '7')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const sends = await prisma.campaignSend.findMany({
      where: {
        status: 'SENT',
        sentAt: { gte: since },
      },
      orderBy: { sentAt: 'desc' },
      include: {
        contact:  { select: { id: true, name: true, phoneE164: true } },
        campaign: { select: { id: true, name: true } },
      },
    })

    return res.json(sends)
  } catch (e) { next(e) }
})

// POST /api/sends/assisted
// Registra que o agente enviou manualmente via extensão Chrome
router.post('/assisted', requireAuth, async (req, res, next) => {
  try {
    const { campaignId, contactId, hotelId, notes } = z.object({
      campaignId: z.string().optional(),
      contactId:  z.string(),
      hotelId:    z.string().optional(),
      notes:      z.string().optional(),
    }).parse(req.body)

    const send = await prisma.campaignSend.create({
      data: {
        campaignId: campaignId ?? null,
        contactId,
        status:   'SENT',
        sentAt:   new Date(),
        notes:    notes ?? null,
        userId:   req.userId,
        hotelId:  hotelId ?? null,
      },
    })

    // Evento de auditoria na linha do tempo do contato
    await prisma.conversationEvent.create({
      data: {
        contactId,
        type:    'OUTBOUND',
        payload: JSON.stringify({ campaignId, sendId: send.id, hotelId, sentBy: req.userId }),
      },
    })

    return res.json(send)
  } catch (e) { next(e) }
})

// PATCH /api/sends/:id/replied
// Marca um envio como respondido
router.patch('/:id/replied', requireAuth, async (req, res, next) => {
  try {
    const send = await prisma.campaignSend.update({
      where: { id: req.params.id },
      data:  { status: 'REPLIED', repliedAt: new Date() },
    })
    return res.json(send)
  } catch (e) { next(e) }
})

// GET /api/sends/wa-web/status
router.get('/wa-web/status', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return res.json({ ok: true, ...waWebStatus(req.userId) })
  } catch (e) { next(e) }
})

// POST /api/sends/wa-web/start
router.post('/wa-web/start', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    try {
      await waWebStart(req.userId)
    } catch (err) {
      const message = parseErrorMessage(err)
      return res.status(503).json({
        ok: false,
        error: 'WA_WEB_START_FAILED',
        message,
        ...waWebStatus(req.userId),
      })
    }
    return res.json({ ok: true, ...waWebStatus(req.userId) })
  } catch (e) { next(e) }
})

// POST /api/sends/batch-web
router.post('/batch-web', requireAuth, async (req, res, next) => {
  const traceId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    const { campaignId, hotelId, imageUrl, imageDataUrl, items } = BatchWebSchema.parse(req.body)
    const mediaUrl = normalizeMediaUrl(imageUrl, req)
    const mediaDataUrl = String(imageDataUrl || '').trim() || null
    let status = waWebStatus(req.userId)
    if (!status.ready && !status.started) {
      // Auto-start da sessão do usuário atual para evitar 409 "frio" no primeiro disparo.
      try {
        await waWebStart(req.userId)
      } catch (err) {
        const message = parseErrorMessage(err)
        return res.status(503).json({ ok: false, error: 'WA_WEB_START_FAILED', message, ...status })
      }
      status = await waitForWaWebReady(req.userId)
    }
    if (!status.ready && status.started) {
      status = await waitForWaWebReady(req.userId)
    }
    if (!status.ready) {
      return res.status(409).json({ ok: false, error: 'WA_WEB_NOT_READY', ...status })
    }

    // ---------------------------------------------------------------
    // Prepare media ONCE before the loop (fixes batch-only-sends-1 bug)
    // ---------------------------------------------------------------
    const mediaSource = mediaDataUrl || mediaUrl
    let preparedMedia: Awaited<ReturnType<typeof waWebPrepareMedia>> | null = null

    if (mediaSource) {
      try {
        preparedMedia = await waWebPrepareMedia(req.userId, mediaSource)
      } catch (mediaErr) {
        const msg = parseErrorMessage(mediaErr)
        return res.status(422).json({ ok: false, error: 'MEDIA_PREPARE_FAILED', message: msg })
      }
    }

    let sent = 0
    let failed = 0
    const results: Array<{ contactId: string; success: boolean; sendId?: string; error?: string }> = []

    try {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const itemTag = `[${idx + 1}/${items.length}]`
        try {
          // Strip "Imagem da oferta: URL" from caption when media is attached
          const cleanCaption = stripImageUrlFromCaption(item.text, !!preparedMedia)

          let sentMsg: { messageId?: string } | null = null
          let lastSendError: string | null = null

          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              if (preparedMedia) {
                sentMsg = await waWebSendPreparedMedia(
                  req.userId, item.phoneE164, preparedMedia.media, cleanCaption,
                )
              } else {
                sentMsg = await waWebSendText(req.userId, item.phoneE164, cleanCaption)
              }
              lastSendError = null
              break
            } catch (sendErr) {
              lastSendError = parseErrorMessage(sendErr)
              if (attempt < 2) await sleep(1500)
            }
          }

          if (lastSendError || !sentMsg) throw new Error(lastSendError || 'SEND_FAILED')

          const mediaLabel = preparedMedia
            ? mediaSource!.startsWith('data:image/') ? 'local-upload' : mediaSource!
            : null
          const notesParts: string[] = []
          if (mediaLabel) notesParts.push(`waWebMedia:${mediaLabel}`)
          if (sentMsg.messageId) notesParts.push(`waWebMessageId:${sentMsg.messageId}`)

          const send = await prisma.campaignSend.create({
            data: {
              campaignId: campaignId ?? null,
              contactId: item.contactId,
              status: 'SENT',
              sentAt: new Date(),
              notes: notesParts.length > 0 ? notesParts.join(';') : null,
              userId: req.userId,
              hotelId: hotelId ?? null,
            },
          })

          await prisma.conversationEvent.create({
            data: {
              contactId: item.contactId,
              type: 'OUTBOUND',
              payload: JSON.stringify({
                campaignId: campaignId ?? null,
                sendId: send.id,
                hotelId: hotelId ?? null,
                sentBy: req.userId,
                source: 'wa-web',
              }),
            },
          })

          sent += 1
          results.push({ contactId: item.contactId, success: true, sendId: send.id })

          // Wait between contacts (anti-spam + WA rate-limit safety)
          if (idx < items.length - 1) await sleep(1500)
        } catch (err) {
          failed += 1
          const errMsg = parseErrorMessage(err)
          results.push({ contactId: item.contactId, success: false, error: errMsg })
        }
      }
    } finally {
      // Clean up temp file AFTER the entire loop
      if (preparedMedia?.tempPath) {
        waWebCleanupTempFile(preparedMedia.tempPath)
      }
    }

    return res.json({ ok: true, sent, failed, results })
  } catch (e) { next(e) }
})

export default router
