import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'
import { isSuperAdmin } from '../utils/authorization.js'
import { isDatabaseUnavailableError } from '../config/database.js'

export async function authenticate(req, res, next) {
  const token = req.cookies?.session
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  try {
    req.user = await User.findById(payload.sub)
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if ((payload.version || 0) !== (req.user.sessionVersion || 0)) return res.status(401).json({ error: 'Session invalidated. Please sign in again.' })
    if (req.user.disabledAt) return res.status(403).json({ error: 'This learner account has been disabled.' })
    if (req.user.role !== 'super_admin' && req.user.emailVerified === false && req.path !== '/auth/me') {
      return res.status(403).json({ error: 'Verify your email address to use this feature.', code: 'EMAIL_VERIFICATION_REQUIRED' })
    }
    next()
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' })
    }
    next(error)
  }
}

export function requireAdmin(req, res, next) {
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Super Admin access required' })
  next()
}

export function requireVerified(req, res, next) {
  if (req.user?.role === 'super_admin' || req.user?.emailVerified !== false) return next()
  return res.status(403).json({ error: 'Verify your email address to use this feature.', code: 'EMAIL_VERIFICATION_REQUIRED' })
}
