import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import api from './routes/api.js'

const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL?.split(',').map((item) => item.trim()), credentials: true }))
app.use(express.json({ limit: '1mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
app.use(cookieParser())
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/payments', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api', api)
app.use((error, _req, res, next) => {
  void next
  const status = error.status || (error.name === 'ZodError' ? 400 : error.code === 11000 ? 409 : 500)
  if (status >= 500) console.error(error.message)
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message, ...(error.name === 'ZodError' ? { details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) } : {}) })
})

export default app
