// Utilitarios JWT - sign, verify, refresh

import jwt from 'jsonwebtoken'

const SECRET  = process.env.JWT_SECRET   ?? 'dev-secret-troque-em-producao'
const EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d'

export interface JwtPayload {
  userId: string
  email:  string
  role:   string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload
}

// Extrai token do header Authorization: Bearer <token>
export function extractBearer(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim() || null
}
