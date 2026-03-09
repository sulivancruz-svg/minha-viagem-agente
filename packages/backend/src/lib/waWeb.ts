import * as fs from 'node:fs'
import * as path from 'node:path'

type WaClient = any

interface WaWebState {
  started: boolean
  authenticated: boolean
  ready: boolean
  qrRaw: string | null
  qrDataUrl: string | null
  qrFilePath: string | null
  lastError: string | null
  lastEvent: string | null
  lastEventAt: string | null
}

interface WaSession {
  userId: string
  safeUserId: string
  state: WaWebState
  client: WaClient | null
  bootPromise: Promise<void> | null
}

const sessions = new Map<string, WaSession>()

function createInitialState(): WaWebState {
  return {
    started: false,
    authenticated: false,
    ready: false,
    qrRaw: null,
    qrDataUrl: null,
    qrFilePath: null,
    lastError: null,
    lastEvent: null,
    lastEventAt: null,
  }
}

function sanitizeUserId(userId: string): string {
  const clean = String(userId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  return clean || 'anonymous'
}

function getSession(userId: string): WaSession {
  const key = String(userId || '').trim()
  if (!key) throw new Error('WA_WEB_USER_REQUIRED')

  let session = sessions.get(key)
  if (!session) {
    session = {
      userId: key,
      safeUserId: sanitizeUserId(key),
      state: createInitialState(),
      client: null,
      bootPromise: null,
    }
    sessions.set(key, session)
  }
  return session
}

function markEvent(session: WaSession, event: string, details?: string): void {
  const suffix = details ? ` | ${details}` : ''
  const at = new Date().toISOString()
  session.state.lastEvent = event
  session.state.lastEventAt = at
}

function getChromeExecutablePath(): string | undefined {
  const fromEnv = String(process.env.WAWEB_EXECUTABLE_PATH || '').trim()
  if (fromEnv) return fromEnv

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

function persistQr(session: WaSession, dataUrl: string): void {
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const qrBaseDir = path.resolve(process.cwd(), process.env.WAWEB_QR_DIR || '.')
    if (!fs.existsSync(qrBaseDir)) fs.mkdirSync(qrBaseDir, { recursive: true })
    const qrFilePath = path.resolve(qrBaseDir, `waweb-qr-${session.safeUserId}.png`)
    fs.writeFileSync(qrFilePath, Buffer.from(base64, 'base64'))
    session.state.qrFilePath = qrFilePath
  } catch {
    session.state.qrFilePath = null
  }
}

function getDeps() {
  // Import dinamico para evitar acoplamento em build se dependencia ainda nao instalada.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const wweb = require('whatsapp-web.js') as {
    Client: new (opts: Record<string, unknown>) => WaClient
    LocalAuth: new (opts: Record<string, unknown>) => unknown
    MessageMedia: {
      fromUrl: (url: string, options?: Record<string, unknown>) => Promise<unknown>
      fromFilePath: (filePath: string) => unknown
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const qrcode = require('qrcode') as { toDataURL: (value: string) => Promise<string> }
  return { wweb, qrcode }
}

function normalizeDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '')
}

function resolveLocalMediaFilePath(mediaUrl: string): string | null {
  const raw = String(mediaUrl || '').trim()
  if (!raw) return null

  let pathname = ''
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname
    } catch {
      return null
    }
  } else if (raw.startsWith('/')) {
    pathname = raw
  } else {
    return null
  }

  if (!pathname.startsWith('/api/media/')) return null
  const relativeMediaPath = pathname.replace(/^\/api\/media\//, '').replace(/^\/+/, '')
  if (!relativeMediaPath) return null

  const filePath = path.resolve(process.cwd(), 'uploads', relativeMediaPath)
  return fs.existsSync(filePath) ? filePath : null
}

function resolveTempFileFromDataUrl(mediaUrl: string): string | null {
  const raw = String(mediaUrl || '').trim()
  const match = raw.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null

  const mimeType = String(match[1] || '').trim()
  const base64Data = String(match[2] || '').trim()
  if (!mimeType || !base64Data) return null

  const ext = mimeType.split('/')[1] || 'jpg'
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const tmpDir = path.resolve(process.cwd(), 'uploads', 'tmp-send')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFilePath = path.resolve(tmpDir, `offer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`)
  fs.writeFileSync(tmpFilePath, Buffer.from(base64Data, 'base64'))
  return tmpFilePath
}

async function bootClient(userId: string): Promise<void> {
  const session = getSession(userId)
  if (session.bootPromise) return session.bootPromise

  session.bootPromise = (async () => {
    const { wweb, qrcode } = getDeps()

    if (!session.client) {
      const authBasePath = path.resolve(process.cwd(), process.env.WAWEB_DATA_PATH || '.wwebjs_auth_live')
      const clientPrefix = String(process.env.WAWEB_CLIENT_PREFIX || 'mv-user').trim() || 'mv-user'
      const clientId = `${clientPrefix}-${session.safeUserId}`
      const executablePath = getChromeExecutablePath()
      const headless = String(process.env.WAWEB_HEADLESS || 'true').toLowerCase() !== 'false'
      markEvent(session, 'boot_client', `authBasePath=${authBasePath}; clientId=${clientId}; headless=${headless}`)

      session.client = new wweb.Client({
        authStrategy: new wweb.LocalAuth({ dataPath: authBasePath, clientId }),
        puppeteer: {
          headless,
          executablePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      })

      session.client.on('qr', async (qr: string) => {
        markEvent(session, 'qr')
        session.state.qrRaw = qr
        session.state.ready = false
        session.state.authenticated = false
        try {
          session.state.qrDataUrl = await qrcode.toDataURL(qr)
          if (session.state.qrDataUrl) persistQr(session, session.state.qrDataUrl)
        } catch {
          session.state.qrDataUrl = null
          session.state.qrFilePath = null
        }
      })

      session.client.on('authenticated', () => {
        markEvent(session, 'authenticated')
        session.state.authenticated = true
        session.state.lastError = null
      })

      session.client.on('ready', () => {
        markEvent(session, 'ready')
        session.state.ready = true
        session.state.started = true
        session.state.qrRaw = null
        session.state.qrDataUrl = null
        session.state.qrFilePath = null
        session.state.lastError = null
      })

      session.client.on('auth_failure', (msg: string) => {
        markEvent(session, 'auth_failure', msg)
        session.state.ready = false
        session.state.authenticated = false
        session.state.lastError = msg || 'AUTH_FAILURE'
      })

      session.client.on('disconnected', (reason: string) => {
        markEvent(session, 'disconnected', reason)
        session.state.ready = false
        session.state.authenticated = false
        session.state.started = false
        session.state.lastError = reason || 'DISCONNECTED'
      })
    }

    if (!session.state.started) {
      markEvent(session, 'initialize')
      await session.client.initialize()
      session.state.started = true
      markEvent(session, 'initialize_done')
    }
  })().finally(() => {
    session.bootPromise = null
  })

  return session.bootPromise
}

export async function waWebStart(userId: string): Promise<void> {
  await bootClient(userId)
}

interface WaResetOptions {
  purgeAuth?: boolean
}

function getAuthPaths(session: WaSession): { authBasePath: string; sessionDir: string } {
  const authBasePath = path.resolve(process.cwd(), process.env.WAWEB_DATA_PATH || '.wwebjs_auth_live')
  const clientPrefix = String(process.env.WAWEB_CLIENT_PREFIX || 'mv-user').trim() || 'mv-user'
  const clientId = `${clientPrefix}-${session.safeUserId}`
  const sessionDir = path.resolve(authBasePath, `session-${clientId}`)
  return { authBasePath, sessionDir }
}

export async function waWebReset(userId: string, options: WaResetOptions = {}): Promise<void> {
  const session = getSession(userId)

  if (session.client) {
    try {
      await session.client.destroy()
      markEvent(session, 'destroy')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      markEvent(session, 'destroy_error', msg)
    }
  }

  session.client = null
  session.bootPromise = null
  session.state = createInitialState()

  if (options.purgeAuth) {
    try {
      const { sessionDir } = getAuthPaths(session)
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
        markEvent(session, 'auth_purged', `path=${sessionDir}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      markEvent(session, 'auth_purge_error', msg)
      session.state.lastError = msg
    }
  }
}

export function waWebStatus(userId: string) {
  const session = getSession(userId)
  return {
    started: session.state.started,
    authenticated: session.state.authenticated,
    ready: session.state.ready,
    qrAvailable: Boolean(session.state.qrDataUrl),
    qrDataUrl: session.state.qrDataUrl,
    qrFilePath: session.state.qrFilePath,
    lastError: session.state.lastError,
    lastEvent: session.state.lastEvent,
    lastEventAt: session.state.lastEventAt,
  }
}

function isRecoverableSendError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const normalized = message.toLowerCase()
  return normalized.includes('detached frame')
    || normalized.includes('execution context was destroyed')
    || normalized.includes('cannot find context with specified id')
    || normalized.includes('target closed')
}

async function sendWithRecovery(
  userId: string,
  action: (client: WaClient) => Promise<{ messageId?: string }>,
): Promise<{ messageId?: string }> {
  await bootClient(userId)
  let session = getSession(userId)
  if (!session.client || !session.state.ready) {
    throw new Error('WA_WEB_NOT_READY')
  }

  try {
    return await action(session.client)
  } catch (err) {
    if (!isRecoverableSendError(err)) throw err

    const message = err instanceof Error ? err.message : String(err)
    markEvent(session, 'send_recoverable_error', message)
    session.state.ready = false
    session.state.lastError = message

    await waWebReset(userId)
    await bootClient(userId)
    session = getSession(userId)
    if (!session.client || !session.state.ready) {
      throw new Error('WA_WEB_NOT_READY')
    }

    markEvent(session, 'send_retry_after_reset')
    return action(session.client)
  }
}

export async function waWebSendText(userId: string, phoneE164: string, text: string): Promise<{ messageId?: string }> {
  return sendWithRecovery(userId, async client => {
    const chatId = await resolveWaChatId(client, phoneE164)
    const msg = await client.sendMessage(chatId, text)
    const messageId = msg?.id?._serialized ? String(msg.id._serialized) : undefined
    return { messageId }
  })
}

export async function waWebSendMedia(
  userId: string,
  phoneE164: string,
  mediaUrl: string,
  caption?: string,
): Promise<{ messageId?: string }> {
  const cleanMediaUrl = String(mediaUrl || '').trim()
  if (!cleanMediaUrl) throw new Error('INVALID_MEDIA_URL')

  const { wweb } = getDeps()
  const dataUrlTempPath = resolveTempFileFromDataUrl(cleanMediaUrl)
  const localFilePath = resolveLocalMediaFilePath(cleanMediaUrl)
  const filePathToSend = dataUrlTempPath || localFilePath
  const media = filePathToSend
    ? wweb.MessageMedia.fromFilePath(filePathToSend)
    : await wweb.MessageMedia.fromUrl(cleanMediaUrl, { unsafeMime: true })
  try {
    return sendWithRecovery(userId, async client => {
      const chatId = await resolveWaChatId(client, phoneE164)
      const msg = await client.sendMessage(chatId, media, {
        caption: String(caption || '').trim() || undefined,
      })
      const messageId = msg?.id?._serialized ? String(msg.id._serialized) : undefined
      return { messageId }
    })
  } finally {
    if (dataUrlTempPath && fs.existsSync(dataUrlTempPath)) {
      try { fs.rmSync(dataUrlTempPath, { force: true }) } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Batch-optimised: prepare media ONCE, reuse for N contacts
// ---------------------------------------------------------------------------

export interface PreparedMedia {
  media: unknown
  tempPath: string | null
}

/**
 * Resolve media (URL, data-URL or local path) into a reusable MessageMedia
 * object.  Call once before the loop; the returned `media` can be passed to
 * `waWebSendPreparedMedia` for every recipient.
 */
export async function waWebPrepareMedia(
  userId: string,
  mediaUrl: string,
): Promise<PreparedMedia> {
  await bootClient(userId)
  const session = getSession(userId)
  if (!session.client || !session.state.ready) {
    throw new Error('WA_WEB_NOT_READY')
  }

  const cleanMediaUrl = String(mediaUrl || '').trim()
  if (!cleanMediaUrl) throw new Error('INVALID_MEDIA_URL')

  const { wweb } = getDeps()
  const dataUrlTempPath = resolveTempFileFromDataUrl(cleanMediaUrl)
  const localFilePath = resolveLocalMediaFilePath(cleanMediaUrl)
  const filePathToSend = dataUrlTempPath || localFilePath
  const media = filePathToSend
    ? wweb.MessageMedia.fromFilePath(filePathToSend)
    : await wweb.MessageMedia.fromUrl(cleanMediaUrl, { unsafeMime: true })

  return { media, tempPath: dataUrlTempPath }
}

/**
 * Resolve the correct WhatsApp chatId for a Brazilian phone number.
 * Tries the raw digits first; if not registered, tries the alternate
 * form (with/without the 9th digit for mobile numbers).
 *
 * Returns the working chatId (e.g. "5541999990001@c.us") or throws.
 */
async function resolveWaChatId(
  client: WaClient,
  phoneE164: string,
): Promise<string> {
  const digits = normalizeDigits(phoneE164)
  if (!digits) throw new Error('INVALID_PHONE')

  // --- Attempt 1: getNumberId with original digits ---
  try {
    const numberId = await client.getNumberId(digits)
    if (numberId?._serialized) {
      const resolved = String(numberId._serialized)
      if (resolved !== `${digits}@c.us`) {
      }
      return resolved
    }
  } catch { /* getNumberId may throw */ }

  // --- Attempt 2: Brazilian mobile 9th-digit fallback ---
  // Format: 55 + DD (2 digits) + 9? + 8 digits
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const countryArea = digits.slice(0, 4) // "5541"
    const rest = digits.slice(4)

    let altDigits: string | null = null
    if (rest.length === 9 && rest.startsWith('9')) {
      altDigits = countryArea + rest.slice(1)   // remove 9
    } else if (rest.length === 8) {
      altDigits = countryArea + '9' + rest      // add 9
    }

    if (altDigits) {
      try {
        const altNumberId = await client.getNumberId(altDigits)
        if (altNumberId?._serialized) {
          const resolved = String(altNumberId._serialized)
          return resolved
        }
      } catch { /* ignore */ }
    }
  }

  // --- Attempt 3: plain chatId (legacy fallback) ---
  // Some older WA sessions accept the raw number even when getNumberId fails
  const fallbackId = `${digits}@c.us`
  return fallbackId
}

/**
 * Send an already-prepared MessageMedia object to one recipient.
 * No additional network download — just sends the in-memory media.
 * Automatically resolves BR phone numbers (with/without 9th digit).
 */
export async function waWebSendPreparedMedia(
  userId: string,
  phoneE164: string,
  media: unknown,
  caption?: string,
): Promise<{ messageId?: string }> {
  return sendWithRecovery(userId, async client => {
    const chatId = await resolveWaChatId(client, phoneE164)
    const msg = await client.sendMessage(chatId, media, {
      caption: String(caption || '').trim() || undefined,
    })
    const messageId = msg?.id?._serialized ? String(msg.id._serialized) : undefined
    return { messageId }
  })
}

/**
 * Clean up temp file created by waWebPrepareMedia (data-URL case).
 * Call in a `finally` block AFTER the entire batch loop finishes.
 */
export function waWebCleanupTempFile(tempPath: string | null): void {
  if (tempPath && fs.existsSync(tempPath)) {
    try { fs.rmSync(tempPath, { force: true }) } catch { /* ignore */ }
  }
}
