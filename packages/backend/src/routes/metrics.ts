// Metricas e funil de vendas

import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/metrics/funnel - funil de vendas
router.get('/funnel', requireAuth, async (req, res, next) => {
  try {
    const stages = await prisma.leadStage.groupBy({
      by:      ['stage'],
      _count:  { stage: true },
    })

    const funnel = {
      NEW:              0,
      CONTACTED:        0,
      QUOTE_REQUESTED:  0,
      PROPOSAL_SENT:    0,
      CLOSED_WON:       0,
      CLOSED_LOST:      0,
      OPTED_OUT:        0,
    }
    for (const s of stages) {
      if (s.stage in funnel) {
        funnel[s.stage as keyof typeof funnel] = s._count.stage
      }
    }

    const total = Object.values(funnel).reduce((a, b) => a + b, 0)
    const conversion = total > 0 ? ((funnel.CLOSED_WON / total) * 100).toFixed(1) : '0'

    return res.json({ funnel, total, conversion: parseFloat(conversion) })
  } catch (e) { next(e) }
})

// GET /api/metrics/sends?campaignId=...&days=30
router.get('/sends', requireAuth, async (req, res, next) => {
  try {
    const { campaignId, days = '30' } = req.query as { campaignId?: string; days?: string }
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

    const where: Record<string, unknown> = { createdAt: { gte: since } }
    if (campaignId) where.campaignId = campaignId

    const sends = await prisma.campaignSend.groupBy({
      by:     ['status'],
      where,
      _count: { status: true },
    })

    // Schema simplificado: apenas SENT, REPLIED, CANCELLED (sem Cloud API)
    const stats = { SENT: 0, REPLIED: 0, CANCELLED: 0 }
    for (const s of sends) {
      if (s.status in stats) stats[s.status as keyof typeof stats] = s._count.status
    }

    const total     = stats.SENT + stats.REPLIED
    const replyRate = total > 0 ? ((stats.REPLIED / total) * 100).toFixed(1) : '0'

    return res.json({
      stats,
      rates: { reply: parseFloat(replyRate) },
      period: `${days} dias`,
    })
  } catch (e) { next(e) }
})

// GET /api/metrics/overview - visao geral do dashboard
router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const week  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalContacts,
      confirmedOptIn,
      activeCampaigns,
      sendsToday,
      sendsWeek,
      openTasks,
    ] = await Promise.all([
      prisma.contact.count({ where: { blocked: false } }),
      prisma.contact.count({ where: { optInStatus: 'CONFIRMED' } }),
      prisma.campaign.count({ where: { isActive: true } }),
      prisma.campaignSend.count({ where: { sentAt: { gte: today } } }),
      prisma.campaignSend.count({ where: { sentAt: { gte: week } } }),
      prisma.task.count({ where: { done: false } }),
    ])

    return res.json({
      totalContacts,
      confirmedOptIn,
      activeCampaigns,
      sendsToday,
      sendsWeek,
      openTasks,
    })
  } catch (e) { next(e) }
})

// GET /api/metrics/timeline?days=14 - envios por dia
router.get('/timeline', requireAuth, async (req, res, next) => {
  try {
    const days = parseInt((req.query.days as string) ?? '14')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const sends = await prisma.campaignSend.findMany({
      where:  { sentAt: { gte: since } },
      select: { sentAt: true, status: true },
    })

    // Agrupa por dia — schema simples: SENT / REPLIED
    const byDay: Record<string, { sent: number; replied: number }> = {}
    for (const s of sends) {
      if (!s.sentAt) continue
      const day = s.sentAt.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { sent: 0, replied: 0 }
      byDay[day].sent++
      if (s.status === 'REPLIED') byDay[day].replied++
    }

    // Preenche dias sem dados
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      result.push({ date: key, ...(byDay[key] ?? { sent: 0, replied: 0 }) })
    }

    return res.json(result)
  } catch (e) { next(e) }
})

export default router
