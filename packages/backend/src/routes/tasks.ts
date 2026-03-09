import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/tasks?contactId=...&done=false
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { contactId, done } = req.query as { contactId?: string; done?: string }
    const where: Record<string, unknown> = {}
    if (contactId)     where.contactId = contactId
    if (done === 'false') where.done   = false
    if (done === 'true')  where.done   = true

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ done: 'asc' }, { dueAt: 'asc' }],
      include: { contact: { select: { name: true, phoneE164: true } } },
    })
    return res.json(tasks)
  } catch (e) { next(e) }
})

// POST /api/tasks
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = z.object({
      contactId: z.string(),
      title:     z.string().min(1),
      dueAt:     z.string().optional(),
    }).parse(req.body)

    const task = await prisma.task.create({
      data: {
        contactId: data.contactId,
        userId:    req.userId!,
        title:     data.title,
        dueAt:     data.dueAt ? new Date(data.dueAt) : undefined,
      },
    })
    await prisma.conversationEvent.create({
      data: { contactId: data.contactId, type: 'TASK_CREATED', payload: JSON.stringify({ taskId: task.id, title: task.title }) },
    })
    return res.status(201).json(task)
  } catch (e) { next(e) }
})

// POST /api/tasks/:id/complete
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data:  { done: true, doneAt: new Date() },
    })
    await prisma.conversationEvent.create({
      data: { contactId: task.contactId, type: 'TASK_DONE', payload: JSON.stringify({ taskId: task.id }) },
    })
    return res.json(task)
  } catch (e) { next(e) }
})

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
