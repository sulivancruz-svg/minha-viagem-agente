import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Erros de validacao Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error:   'Dados invalidos',
      details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    })
  }

  // Erros do Prisma (violacao de unicidade, etc.)
  if (err instanceof Error && err.message.includes('Unique constraint')) {
    return res.status(409).json({ error: 'Registro duplicado' })
  }

  // Log do erro interno

  // Resposta generica (nao vaza detalhes em producao)
  const msg = process.env.NODE_ENV === 'development' && err instanceof Error
    ? err.message
    : 'Erro interno do servidor'

  return res.status(500).json({ error: msg })
}
