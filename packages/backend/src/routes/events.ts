import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/events?contactId=...
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { contactId, limit = '50' } = req.query as { contactId?: string; limit?: string }
    const where: Record<string, unknown> = {}
    if (contactId) where.contactId = contactId

    const events = await prisma.conversationEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })
    return res.json(events)
  } catch (e) { next(e) }
})

// POST /api/events - registra evento da extensao
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = z.object({
      contactId:  z.string(),
      eventType:  z.string(),
      payload:    z.record(z.unknown()).default({}),
    }).parse(req.body)

    const event = await prisma.conversationEvent.create({
      data: {
        contactId: data.contactId,
        type:      data.eventType as never,
        payload:   JSON.stringify(data.payload),
      },
    })
    return res.status(201).json(event)
  } catch (e) { next(e) }
})

export default router
