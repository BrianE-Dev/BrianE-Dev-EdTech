import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rateLimit } from 'express-rate-limit'
import { isDatabaseReady, isDatabaseUnavailableError } from './config/database.js'
import { classifyTtsDiagnosticStorageError } from './services/ttsRecoveryDiagnostic.js'
import api from './routes/api.js'

const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL?.split(',').map((item) => item.trim()), credentials: true }))
app.use(express.json({ limit: '1mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
app.use(cookieParser())
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/ready' || req.path === '/auth/logout' || req.path === '/diagnostics/hostinger-network') return next()
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' })
  }
  next()
})
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/auth/resend-verification', rateLimit({ windowMs: 60 * 60 * 1000, limit: 4, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/business', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/payments', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
const paymentRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })
app.use('/api/brianedev/payments/initialize', paymentRateLimit)
app.use('/api/brianedev/payments/verify', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/brianedev/payments/paystack/webhook', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/admin/tts', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/diagnostics/hostinger-network', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api', api)
const frontendBuildPath = fileURLToPath(new URL('../../dist', import.meta.url))
if (existsSync(frontendBuildPath)) {
  app.use((req, res, next) => req.path === '/api' || req.path.startsWith('/api/')
    ? next()
    : express.static(frontendBuildPath)(req, res, next))
  app.get('*path', (req, res, next) => req.path === '/api' || req.path.startsWith('/api/')
    ? next()
    : res.sendFile(fileURLToPath(new URL('../../dist/index.html', import.meta.url))))
}
app.use((error, _req, res, next) => {
  void next
  if (isDatabaseUnavailableError(error)) {
    return res.status(503).json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' })
  }
  if (error.code === 'AUDIO_STORAGE_UNAVAILABLE') {
    const storageIssue = classifyTtsDiagnosticStorageError(error)
    console.error(`TTS storage failure: ${storageIssue}; operation=${error.operation || 'unknown'}; httpStatus=${error.httpStatus || 'unknown'}; providerCode=${error.providerCode || 'unknown'}`)
    return res.status(503).json({ error: 'Persistent audio storage is unavailable', code: 'AUDIO_STORAGE_UNAVAILABLE', storageIssue })
  }
  const status = error.status || (error.name === 'ZodError' ? 400 : error.code === 11000 ? 409 : 500)
  if (status >= 500) console.error(error.message)
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message, ...(error.name === 'ZodError' ? { details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) } : {}) })
})

export default app
