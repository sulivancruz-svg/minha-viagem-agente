// Servidor principal - Minha Viagem Agente de Vendas
// Node.js + Express + TypeScript

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'

import authRouter      from './routes/auth'
import contactsRouter  from './routes/contacts'
import campaignsRouter from './routes/campaigns'
import sendsRouter     from './routes/sends'
import metricsRouter   from './routes/metrics'
import tasksRouter     from './routes/tasks'
import eventsRouter    from './routes/events'
import aiRouter        from './routes/ai'
import hotelsRouter    from './routes/hotels'
import adminRouter     from './routes/admin'
import { errorHandler } from './middleware/errorHandler'

const app  = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)
app.set('trust proxy', 1)

// ============================================================
// Middlewares globais
// ============================================================

// CORS PRIMEIRO (antes do helmet) — senao helmet bloqueia preflight
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3005')
  .split(',')
  .map(s => s.trim())

app.use(cors({
  origin: (origin, cb) => {
    // Permite extensoes Chrome e origens configuradas
    if (
      !origin ||
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('https://web.whatsapp.com') ||
      corsOrigins.some(o => origin.startsWith(o))
    ) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  },
  credentials: true,
}))

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}))

app.use(rateLimit({
  windowMs: 60_000,
  max:      300,
  message:  { error: 'Muitas requisicoes. Tente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders:   false,
}))

app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/api/media', express.static(path.resolve(process.cwd(), 'uploads')))

// ============================================================
// Health check (sem autenticacao)
// ============================================================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', time: new Date().toISOString() })
})

// ============================================================
// Rotas
// ============================================================

app.use('/api/auth',      authRouter)
app.use('/api/contacts',  contactsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/sends',     sendsRouter)
app.use('/api/metrics',   metricsRouter)
app.use('/api/tasks',     tasksRouter)
app.use('/api/events',    eventsRouter)
app.use('/api/ai',        aiRouter)
app.use('/api/hotels',    hotelsRouter)
app.use('/api/admin',     adminRouter)   // SaaS: gerenciamento de usuarios (SUPER_ADMIN)

// ============================================================
// Error handler global
// ============================================================

app.use(errorHandler)

// ============================================================
// Inicia servidor
// ============================================================

app.listen(PORT, () => {
})

export default app
