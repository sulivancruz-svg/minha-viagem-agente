import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()
const uploadDir = path.resolve(process.cwd(), 'uploads', 'campaign-media')
fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
})

const CampaignSchema = z.object({
  name:        z.string().min(1),
  destination: z.string().min(1),
  dateRange:   z.string().min(1),
  offerText:   z.string().min(1),
  inclusions:  z.array(z.string()).default([]),
  hotels:      z.array(z.string()).default([]),
  priceFrom:   z.number().optional(),
  ctaText:     z.string().min(1),
  landingUrl:  z.string().url().optional().or(z.literal('')),
  mediaAssets: z.array(z.string()).default([]),
  isActive:    z.boolean().default(true),
})

// GET /api/campaigns
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { active } = req.query
    const where = active === 'true' ? { isActive: true } : {}
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sends: true } },
      },
    })
    return res.json(campaigns.map(c => fromDb(c as never)))
  } catch (e) { next(e) }
})

// GET /api/campaigns/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        _count: { select: { sends: true } },
        sends: {
          select: { status: true },
          take: 1000,
        },
      },
    })

    // Agrega metricas inline
    const stats = campaign.sends.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    return res.json({ ...fromDb(campaign as never), stats })
  } catch (e) { next(e) }
})

// Converte arrays JS para JSON strings (SQLite nao suporta arrays nativos)
function toDb(data: Record<string, unknown>) {
  return {
    ...data,
    inclusions:  JSON.stringify(data.inclusions ?? []),
    hotels:      JSON.stringify(data.hotels ?? []),
    mediaAssets: JSON.stringify(data.mediaAssets ?? []),
  }
}
// Converte JSON strings de volta para arrays ao retornar
function fromDb(row: Record<string, unknown>) {
  return {
    ...row,
    inclusions:  typeof row.inclusions  === 'string' ? JSON.parse(row.inclusions)  : row.inclusions,
    hotels:      typeof row.hotels      === 'string' ? JSON.parse(row.hotels)      : row.hotels,
    mediaAssets: typeof row.mediaAssets === 'string' ? JSON.parse(row.mediaAssets) : row.mediaAssets,
  }
}

// POST /api/campaigns
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = CampaignSchema.parse(req.body)
    const campaign = await prisma.campaign.create({
      data: { ...toDb(data), createdById: req.userId! } as never,
    })
    return res.status(201).json(fromDb(campaign as never))
  } catch (e) { next(e) }
})

// POST /api/campaigns/upload-media
router.post('/upload-media', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo nao enviado' })
    const mediaUrl = `/api/media/campaign-media/${req.file.filename}`
    return res.status(201).json({ ok: true, mediaUrl, filename: req.file.filename })
  } catch (e) { next(e) }
})

// PATCH /api/campaigns/:id
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const data = CampaignSchema.partial().parse(req.body)
    const dbData = toDb(data)
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data:  dbData as never,
    })
    return res.json(fromDb(campaign as never))
  } catch (e) { next(e) }
})

// DELETE /api/campaigns/:id (soft delete)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.campaign.update({
      where: { id: req.params.id },
      data:  { isActive: false },
    })
    return res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
