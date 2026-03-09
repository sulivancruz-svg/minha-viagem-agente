// Middleware de autenticacao: aceita JWT ou API token

import type { Request, Response, NextFunction } from 'express'
import { verifyToken, extractBearer } from '../lib/jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Extende o tipo Request para incluir dados do usuario autenticado
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
      userRole?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Token nao fornecido' })
  }

  // Tenta JWT primeiro
  try {
    const payload = verifyToken(token)
    req.userId    = payload.userId
    req.userEmail = payload.email
    req.userRole  = payload.role
    return next()
  } catch {
    // Nao e um JWT valido, tenta como API token estatico
  }

  // API token (para extensao Chrome - token armazenado no DB)
  try {
    const user = await prisma.user.findUnique({ where: { apiToken: token } })
    if (!user) {
      return res.status(401).json({ error: 'Token invalido' })
    }
    req.userId    = user.id
    req.userEmail = user.email
    req.userRole  = user.role
    return next()
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao verificar autenticacao' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' })
  }
  next()
}
