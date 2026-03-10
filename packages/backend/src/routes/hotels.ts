// CRUD de Hotéis - Catálogo para agentes de viagem

import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import { promises as fs } from 'fs'

const router = Router()
const prisma = new PrismaClient()

// ============================================================
// Multer - Upload de imagens
// ============================================================

const uploadsDir = path.resolve(process.cwd(), 'uploads')

// Criar diretório se não existir
;(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true })
  } catch (e) {
    console.error('[Hotels] Erro ao criar diretório uploads:', e)
  }
})()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const ext = path.extname(file.originalname)
    cb(null, `hotel-${timestamp}-${random}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Apenas JPEG, PNG, WebP e GIF são permitidos'))
    }
  },
})

// ============================================================
// Validacao Zod
// ============================================================

const HotelSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  destination: z.string().min(2, 'Destino deve ter pelo menos 2 caracteres'),
  stars: z.number().int().min(1).max(5).optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  priceFrom: z.number().positive().optional(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

// ============================================================
// Rotas
// ============================================================

// GET /api/hotels - Lista hotéis com filtros
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { destination, search, page = '1', limit = '20' } = req.query
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const where: Record<string, unknown> = { isActive: true }

    if (destination) {
      where.destination = {
        contains: destination as string,
        mode: 'insensitive',
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { destination: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.hotel.count({ where }),
    ])

    // Parse JSON fields
    const hotelsWithParsed = hotels.map(h => ({
      ...h,
      highlights: JSON.parse(h.highlights || '[]'),
      images: JSON.parse(h.images || '[]'),
    }))

    return res.json({
      hotels: hotelsWithParsed,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/hotels/:id - Detalhe do hotel
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { id: req.params.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel não encontrado' })
    }

    return res.json({
      ...hotel,
      highlights: JSON.parse(hotel.highlights || '[]'),
      images: JSON.parse(hotel.images || '[]'),
    })
  } catch (e) {
    next(e)
  }
})

// POST /api/hotels - Criar hotel
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const validatedData = HotelSchema.parse(req.body)
    const userId = (req as any).userId

    const hotel = await prisma.hotel.create({
      data: {
        ...validatedData,
        highlights: JSON.stringify(validatedData.highlights),
        images: JSON.stringify(validatedData.images),
        createdById: userId,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })

    return res.status(201).json({
      ...hotel,
      highlights: JSON.parse(hotel.highlights || '[]'),
      images: JSON.parse(hotel.images || '[]'),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ errors: e.errors })
    }
    next(e)
  }
})

// PATCH /api/hotels/:id - Editar hotel
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const validatedData = HotelSchema.partial().parse(req.body)

    // Converter arrays para JSON se fornecidos
    const dataToUpdate = { ...validatedData }
    if (validatedData.highlights) {
      dataToUpdate.highlights = JSON.stringify(validatedData.highlights)
    }
    if (validatedData.images) {
      dataToUpdate.images = JSON.stringify(validatedData.images)
    }

    const hotel = await prisma.hotel.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })

    return res.json({
      ...hotel,
      highlights: JSON.parse(hotel.highlights || '[]'),
      images: JSON.parse(hotel.images || '[]'),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ errors: e.errors })
    }
    next(e)
  }
})

// DELETE /api/hotels/:id - Soft delete (marcar como inativo)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.hotel.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })

    return res.json({ message: 'Hotel desativado com sucesso' })
  } catch (e) {
    next(e)
  }
})

// POST /api/hotels/upload-image - Upload de imagem
router.post('/upload-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' })
    }

    // URL relativa para acessar a imagem
    const imageUrl = `/api/media/${req.file.filename}`

    return res.json({
      url: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
    })
  } catch (e) {
    next(e)
  }
})

export default router
