// Criptografia AES-256-CBC para dados sensiveis em repouso (LGPD)
// Usado para emails e outros campos PII

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY_HEX = process.env.ENCRYPTION_KEY ?? ''

// Garante que a chave tem 32 bytes; em dev usa fallback inseguro
function getKey(): Buffer {
  if (KEY_HEX.length === 64) return Buffer.from(KEY_HEX, 'hex')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY nao configurada em producao')
  }
  // Dev fallback: chave fraca, nunca usar em producao
  return Buffer.alloc(32, 'dev')
}

const ALGO = 'aes-256-cbc'
const IV_LEN = 16

export function encrypt(text: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  // Retorna iv:encrypted em base64
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, dataHex] = stored.split(':')
  if (!ivHex || !dataHex) throw new Error('Formato de dado criptografado invalido')
  const key     = getKey()
  const iv      = Buffer.from(ivHex, 'hex')
  const data    = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGO, key, iv)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// Retorna null se o campo nao estiver criptografado ou estiver vazio
export function decryptOrNull(stored?: string | null): string | null {
  if (!stored) return null
  try { return decrypt(stored) } catch { return null }
}
