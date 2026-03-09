// Rota de hoteis - Catalogo de hoteis para ofertas
// CRUD completo + upload de imagens

import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const uploadDir = path.resolve(process.cwd(), 'uploads', 'hotel-images')
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

const HotelSchema = z.object({
  name:        z.string().min(2),
  destination: z.string().min(2),
  stars:       z.number().int().min(1).max(5).optional(),
  description: z.string().optional(),
  highlights:  z.array(z.string()).default([]),
  priceFrom:   z.number().positive().optional(),
  images:      z.array(z.string()).default([]),
  isActive:    z.boolean().default(true),
})

// Converte arrays JS para JSON strings (SQLite)
function toDb(data: Record<string, unknown>) {
  return {
    ...data,
    highlights: JSON.stringify(data.highlights ?? []),
    images:     JSON.stringify(data.images ?? []),
  }
}

function fromDb(row: Record<string, unknown>) {
  return {
    ...row,
    highlights: typeof row.highlights === 'string' ? JSON.parse(row.highlights) : row.highlights,
    images:     typeof row.images     === 'string' ? JSON.parse(row.images)     : row.images,
  }
}

// GET /api/hotels — lista hoteis ativos (com filtros opcionais)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { destination, search, all, ids } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (all !== 'true') where.isActive = true
    if (ids) {
      const list = ids.split(',').map(v => v.trim()).filter(Boolean)
      if (list.length > 0) where.id = { in: list }
    }
    if (destination) where.destination = { contains: destination }
    if (search) {
      where.OR = [
        { name:        { contains: search } },
        { destination: { contains: search } },
      ]
    }

    const hotels = await prisma.hotel.findMany({
      where: where as any,
      orderBy: { name: 'asc' },
    })

    return res.json(hotels.map(h => fromDb(h as never)))
  } catch (e) { next(e) }
})

// GET /api/hotels/:id — detalhe
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: req.params.id } })
    return res.json(fromDb(hotel as never))
  } catch (e) { next(e) }
})

// POST /api/hotels — criar hotel
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = HotelSchema.parse(req.body)
    const hotel = await prisma.hotel.create({
      data: { ...toDb(data), createdById: req.userId! } as never,
    })
    return res.status(201).json(fromDb(hotel as never))
  } catch (e) { next(e) }
})

// POST /api/hotels/upload-image — upload de imagem do hotel
router.post('/upload-image', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo nao enviado' })
    const mediaUrl = `/api/media/hotel-images/${req.file.filename}`
    return res.status(201).json({ ok: true, mediaUrl, filename: req.file.filename })
  } catch (e) { next(e) }
})

// PATCH /api/hotels/:id — editar hotel
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const data = HotelSchema.partial().parse(req.body)
    const dbData = toDb(data)
    const hotel = await prisma.hotel.update({
      where: { id: req.params.id },
      data:  dbData as never,
    })
    return res.json(fromDb(hotel as never))
  } catch (e) { next(e) }
})

// DELETE /api/hotels/:id — soft delete
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.hotel.update({
      where: { id: req.params.id },
      data:  { isActive: false },
    })
    return res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
