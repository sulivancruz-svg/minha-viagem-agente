// CRUD de contatos + importacao CSV + endpoints da extensao

import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
type OptInStatus = 'PENDING' | 'CONFIRMED' | 'BLOCKED'
import { requireAuth } from '../middleware/auth'
import { encrypt, decryptOrNull } from '../lib/crypto'

const router = Router()
const prisma = new PrismaClient()

// Validacao
const ContactSchema = z.object({
  name:           z.string().min(1),
  phoneE164:      z.string().regex(/^\+\d{10,15}$/, 'Telefone deve estar no formato E.164 (+55119...)'),
  email:          z.string().email().optional(),
  tags:           z.array(z.string()).default([]),
  optInStatus:    z.enum(['PENDING', 'CONFIRMED', 'BLOCKED']).default('PENDING'),
  optInSource:    z.string().optional(),
  notes:          z.string().optional(),
})

// GET /api/contacts
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = '1', limit = '50', search, stage, tag, optIn } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: Record<string, unknown> = {}
    if (search)  where.OR = [{ name: { contains: search } }, { phoneE164: { contains: search } }]
    if (optIn)   where.optInStatus = optIn as OptInStatus
    if (tag)     where.tags        = { contains: tag } // busca na JSON string
    if (stage) {
      where.leadStage = { stage }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { leadStage: true },
      }),
      prisma.contact.count({ where }),
    ])

    return res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (e) { next(e) }
})

// GET /api/contacts/by-phone/:phone - usado pela extensao
router.get('/by-phone/:phone', requireAuth, async (req, res, next) => {
  try {
    const phone = decodeURIComponent(req.params.phone)
    const contact = await prisma.contact.findUnique({ where: { phoneE164: phone } })
    return res.json(contact ?? null)
  } catch (e) { next(e) }
})

// GET /api/contacts/:id/lead - dados completos do lead para a extensao
router.get('/:id/lead', requireAuth, async (req, res, next) => {
  try {
    const contact = await prisma.contact.findUniqueOrThrow({
      where:   { id: req.params.id },
      include: {
        leadStage: true,
        tasks:     { orderBy: { dueAt: 'asc' } },
        sends:     {
          include: { campaign: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take:    10,
        },
      },
    })

    return res.json({
      contactId:       contact.id,
      contactName:     contact.name,
      phoneE164:       contact.phoneE164,
      stage:           contact.leadStage?.stage ?? 'NEW',
      tags:            typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags,
      notes:           contact.notes,
      lastInteraction: contact.updatedAt.toISOString(),
      campaigns:       contact.sends.map(s => ({
        name:   s.campaign?.name ?? '(oferta avulsa)',
        sentAt: s.sentAt?.toISOString() ?? s.createdAt.toISOString(),
        status: s.status,
      })),
      tasks: contact.tasks.map(t => ({
        id:        t.id,
        contactId: t.contactId,
        title:     t.title,
        dueAt:     t.dueAt?.toISOString(),
        done:      t.done,
      })),
    })
  } catch (e) { next(e) }
})

// POST /api/contacts
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = ContactSchema.parse(req.body)
    const contact = await prisma.contact.create({
      data: {
        name:          data.name,
        phoneE164:     data.phoneE164,
        encryptedEmail: data.email ? encrypt(data.email) : undefined,
        tags:          JSON.stringify(data.tags),
        optInStatus:   data.optInStatus,
        optInSource:   data.optInSource,
        optInTimestamp: data.optInStatus === 'CONFIRMED' ? new Date() : undefined,
        optInIp:       req.ip,
        notes:         data.notes,
      },
    })
    // Cria LeadStage inicial
    await prisma.leadStage.create({ data: { contactId: contact.id } })
    return res.status(201).json(contact)
  } catch (e) { next(e) }
})

// PATCH /api/contacts/:id/stage
router.patch('/:id/stage', requireAuth, async (req, res, next) => {
  try {
    const { stage } = z.object({ stage: z.string() }).parse(req.body)
    await prisma.leadStage.upsert({
      where:  { contactId: req.params.id },
      update: { stage: stage as never },
      create: { contactId: req.params.id, stage: stage as never },
    })
    await prisma.conversationEvent.create({
      data: {
        contactId: req.params.id,
        type: 'STAGE_CHANGE',
        payload: JSON.stringify({ stage, changedBy: req.userId }),
      },
    })
    return res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/contacts/:id/block - opt-out
router.post('/:id/block', requireAuth, async (req, res, next) => {
  try {
    await prisma.contact.update({
      where: { id: req.params.id },
      data:  { blocked: true, blockedAt: new Date(), optInStatus: 'BLOCKED' },
    })
    await prisma.leadStage.upsert({
      where:  { contactId: req.params.id },
      update: { stage: 'OPTED_OUT' },
      create: { contactId: req.params.id, stage: 'OPTED_OUT' },
    })
    await prisma.conversationEvent.create({
      data: {
        contactId: req.params.id,
        type: 'OPT_OUT',
        payload: JSON.stringify({ source: 'manual', blockedBy: req.userId }),
      },
    })
    return res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/contacts/import - importa CSV
// Campos esperados: name, phone, tags (separadas por |), opt_in_status
router.post('/import', requireAuth, async (req, res, next) => {
  try {
    const { rows } = z.object({
      rows: z.array(z.object({
        name:         z.string(),
        phone:        z.string(),
        tags:         z.string().default(''),
        opt_in:       z.string().default('PENDING'),
        opt_in_source: z.string().default('csv_import'),
      })),
    }).parse(req.body)

    let created = 0, skipped = 0, errors = 0
    for (const row of rows) {
      try {
        // Normaliza telefone para E.164
        let phone = row.phone.replace(/\D/g, '')
        if (!phone.startsWith('55')) phone = '55' + phone
        phone = '+' + phone

        const tags = row.tags ? row.tags.split('|').map(t => t.trim()).filter(Boolean) : []
        const optIn = ['CONFIRMED', 'PENDING', 'BLOCKED'].includes(row.opt_in.toUpperCase())
          ? row.opt_in.toUpperCase() as OptInStatus
          : 'PENDING' as OptInStatus

        const existing = await prisma.contact.findUnique({ where: { phoneE164: phone } })
        if (existing) { skipped++; continue }

        const contact = await prisma.contact.create({
          data: {
            name:           row.name,
            phoneE164:      phone,
            tags:           JSON.stringify(tags),
            optInStatus:    optIn,
            optInSource:    row.opt_in_source,
            optInTimestamp: optIn === 'CONFIRMED' ? new Date() : undefined,
          },
        })
        await prisma.leadStage.create({ data: { contactId: contact.id } })
        created++
      } catch { errors++ }
    }

    return res.json({ created, skipped, errors, total: rows.length })
  } catch (e) { next(e) }
})

// DELETE /api/contacts/:id - exclusao LGPD
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    // Remove dados pessoais mas mantém registros anonimizados
    await prisma.contact.update({
      where: { id: req.params.id },
      data:  {
        name:           '[Removido]',
        phoneE164:      `deleted_${req.params.id}`,
        encryptedEmail: null,
        tags:           '[]',
        notes:          null,
        optInStatus:    'BLOCKED',
      },
    })
    return res.json({ ok: true, message: 'Dados pessoais removidos (anonimizacao LGPD)' })
  } catch (e) { next(e) }
})

export default router
