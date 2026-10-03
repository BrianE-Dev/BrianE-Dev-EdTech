import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.session
    if (!token) return res.status(401).json({ error: 'Authentication required' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(payload.sub)
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    next()
  } catch { res.status(401).json({ error: 'Invalid or expired session' }) }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin access required' })
  next()
}
