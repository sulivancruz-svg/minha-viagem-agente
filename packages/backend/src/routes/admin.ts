import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { waWebReset, waWebStart, waWebStatus } from '../lib/waWeb'

const router = Router()
const prisma = new PrismaClient()

// Middleware: apenas SUPER_ADMIN acessa /api/admin
router.use(requireAuth, (req, res, next) => {
  if ((req as any).userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores da plataforma.' })
  }
  next()
})

// ────────────────────────────────────────────────────────────
// GET /api/admin/users — lista todos os usuários
// ────────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id:             true,
        name:           true,
        email:          true,
        whatsappNumber: true,
        role:           true,
        isActive:       true,
        lastActiveAt:   true,
        createdAt:      true,
        // nunca retornar passwordHash / apiToken em listagem
        _count: {
          select: {
            campaigns: true,
            tasks:     true,
            sends:     true,
          },
        },
      },
    })

    // Conta respostas (REPLIED) por usuario
    const repliedCounts = await prisma.campaignSend.groupBy({
      by: ['userId'],
      where: { status: 'REPLIED', userId: { not: null } },
      _count: true,
    })
    const repliedMap = new Map(repliedCounts.map(r => [r.userId, r._count]))

    const enriched = users.map(u => ({
      ...u,
      _count: {
        ...u._count,
        sendsReplied: repliedMap.get(u.id) ?? 0,
      },
    }))

    res.json({ users: enriched, total: enriched.length })
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// GET /api/admin/users/:id — detalhe de um usuário (com apiToken)
// ────────────────────────────────────────────────────────────
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where:  { id: req.params.id },
      select: {
        id:             true,
        name:           true,
        email:          true,
        whatsappNumber: true,
        apiToken:       true,
        role:           true,
        isActive:       true,
        lastActiveAt:   true,
        createdAt:      true,
      },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// POST /api/admin/users — cria novo usuário (agência/agente)
// ────────────────────────────────────────────────────────────
const createSchema = z.object({
  name:           z.string().min(2).max(100),
  email:          z.string().email(),
  password:       z.string().min(8),
  whatsappNumber: z.string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Número deve estar no formato E.164 ex: +5511999999999')
    .optional(),
  role: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
})

router.post('/users', async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body)
    const passwordHash = await bcrypt.hash(body.password, 12)
    const apiToken = randomUUID()

    const user = await prisma.user.create({
      data: {
        name:           body.name,
        email:          body.email,
        passwordHash,
        apiToken,
        whatsappNumber: body.whatsappNumber ?? null,
        role:           body.role,
        isActive:       true,
      },
      select: {
        id:             true,
        name:           true,
        email:          true,
        whatsappNumber: true,
        apiToken:       true,
        role:           true,
        isActive:       true,
        createdAt:      true,
      },
    })

    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id — atualiza dados do usuário
// ────────────────────────────────────────────────────────────
const updateSchema = z.object({
  name:           z.string().min(2).max(100).optional(),
  whatsappNumber: z.string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Número deve estar no formato E.164 ex: +5511999999999')
    .nullable()
    .optional(),
  isActive:       z.boolean().optional(),
  role:           z.enum(['ADMIN', 'AGENT']).optional(),
})

router.patch('/users/:id', async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body)
    const user = await prisma.user.update({
      where:  { id: req.params.id },
      data:   body,
      select: {
        id:             true,
        name:           true,
        email:          true,
        whatsappNumber: true,
        role:           true,
        isActive:       true,
        updatedAt:      true,
      },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/rotate-token — gera novo apiToken
// ────────────────────────────────────────────────────────────
router.post('/users/:id/rotate-token', async (req, res, next) => {
  try {
    const newToken = randomUUID()
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { apiToken: newToken },
    })
    res.json({ apiToken: newToken, message: 'Token renovado com sucesso. O agente precisará atualizar o token na extensão.' })
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/reset-password — redefine senha
// ────────────────────────────────────────────────────────────
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body)
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { passwordHash },
    })
    res.json({ ok: true, message: 'Senha redefinida com sucesso.' })
  } catch (err) {
    next(err)
  }
})

// ────────────────────────────────────────────────────────────
// GET /api/admin/users/:id/metrics — metricas de desempenho do agente
// ────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id — exclui usuario sem vinculos
router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    })

    if (user.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Nao e permitido excluir conta SUPER_ADMIN.' })
    }

    if (req.userId && req.userId === userId) {
      return res.status(403).json({ error: 'Nao e permitido excluir o proprio usuario logado.' })
    }

    const campaignIds = await prisma.campaign.findMany({
      where: { createdById: userId },
      select: { id: true },
    })
    const campaignIdList = campaignIds.map(c => c.id)

    const result = await prisma.$transaction(async tx => {
      const tasks = await tx.task.deleteMany({ where: { userId } })
      const hotels = await tx.hotel.deleteMany({ where: { createdById: userId } })
      const sends = await tx.campaignSend.deleteMany({
        where: {
          OR: [
            { userId },
            ...(campaignIdList.length > 0 ? [{ campaignId: { in: campaignIdList } }] : []),
          ],
        },
      })
      const campaigns = await tx.campaign.deleteMany({ where: { createdById: userId } })
      await tx.user.delete({ where: { id: userId } })
      return {
        tasks: tasks.count,
        hotels: hotels.count,
        sends: sends.count,
        campaigns: campaigns.count,
      }
    })

    return res.json({ ok: true, deletedUserId: userId, deleted: result })
  } catch (err) {
    next(err)
  }
})

router.get('/users/:id/metrics', async (req, res, next) => {
  try {
    const userId = req.params.id
    const days = parseInt((req.query as Record<string, string>).days ?? '30')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [totalSends, totalReplied, totalTasks, completedTasks, activeContacts] = await Promise.all([
      prisma.campaignSend.count({ where: { userId, sentAt: { gte: since } } }),
      prisma.campaignSend.count({ where: { userId, status: 'REPLIED', sentAt: { gte: since } } }),
      prisma.task.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.task.count({ where: { userId, done: true, createdAt: { gte: since } } }),
      prisma.campaignSend.groupBy({
        by: ['contactId'],
        where: { userId, sentAt: { gte: since } },
      }).then(r => r.length),
    ])

    // Timeline: envios por dia (ultimos N dias)
    const sends = await prisma.campaignSend.findMany({
      where: { userId, sentAt: { gte: since } },
      select: { sentAt: true, status: true },
      orderBy: { sentAt: 'asc' },
    })

    const sendsByDay: Record<string, { sent: number; replied: number }> = {}
    for (const s of sends) {
      const day = s.sentAt.toISOString().slice(0, 10)
      if (!sendsByDay[day]) sendsByDay[day] = { sent: 0, replied: 0 }
      sendsByDay[day].sent++
      if (s.status === 'REPLIED') sendsByDay[day].replied++
    }

    // Ultimos envios
    const recentSends = await prisma.campaignSend.findMany({
      where: { userId, sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
      take: 20,
      include: {
        contact:  { select: { name: true, phoneE164: true } },
        campaign: { select: { name: true } },
      },
    })

    res.json({
      totalSends,
      totalReplied,
      replyRate: totalSends > 0 ? Math.round((totalReplied / totalSends) * 100) : 0,
      totalTasks,
      completedTasks,
      activeContacts,
      sendsByDay,
      recentSends,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/users/:id/wa-web/status — status WA Web da sessao do usuario
router.get('/users/:id/wa-web/status', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    const status = waWebStatus(user.id)
    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      ...status,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/wa-web/start — inicia/reinicia sessao WA Web do usuario e gera QR
router.post('/users/:id/wa-web/start', async (req, res, next) => {
  try {
    const { forceNew } = z.object({ forceNew: z.boolean().optional() }).parse(req.body ?? {})
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    if (forceNew) {
      await waWebReset(user.id, { purgeAuth: true })
    }
    await waWebStart(user.id)
    const status = waWebStatus(user.id)
    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      ...status,
    })
  } catch (err) {
    next(err)
  }
})

export default router
