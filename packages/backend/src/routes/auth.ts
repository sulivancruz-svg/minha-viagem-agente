import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { signToken } from '../lib/jwt'
import { requireAuth } from '../middleware/auth'

const router  = Router()
const prisma  = new PrismaClient()

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Credenciais invalidas' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Credenciais invalidas' })

    const token = signToken({ userId: user.id, email: user.email, role: user.role })
    return res.json({
      token,
      apiToken: user.apiToken, // token estatico para a extensao
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/auth/me - retorna usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.userId },
    select: { id: true, name: true, email: true, role: true, apiToken: true },
  })
  return res.json(user)
})

// POST /api/auth/rotate-token - gera novo apiToken para a extensao
router.post('/rotate-token', requireAuth, async (req, res, next) => {
  try {
    const apiToken = randomUUID()
    await prisma.user.update({ where: { id: req.userId }, data: { apiToken } })
    return res.json({ apiToken })
  } catch (e) {
    next(e)
  }
})

export default router
