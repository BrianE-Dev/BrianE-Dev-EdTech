import crypto from 'node:crypto'
import { BusinessContact, BusinessCounter, BusinessRequest, SecurityToken } from '../models/index.js'

export async function nextReference(kind) {
  const prefix = kind === 'quote' ? 'QUO' : 'ENQ'
  const key = `${prefix}-${new Date().getUTCFullYear()}`
  let counter
  try {
    counter = await BusinessCounter.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    counter = await BusinessCounter.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { new: true })
  }
  return `BD-${prefix}-${new Date().getUTCFullYear()}-${String(counter.value).padStart(6, '0')}`
}

export async function saveBusinessRequest(kind, input) {
  const reference = await nextReference(kind)
  const row = await BusinessRequest.create({ ...input, kind, reference })
  await BusinessContact.findOneAndUpdate(
    { email: input.email },
    { $setOnInsert: { name: input.name, email: input.email, company: input.company || '', source: kind } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return row
}

export function createSecurityToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') }
}

export async function issueSecurityToken(user, purpose) {
  const userId = user._id || user.id
  await SecurityToken.deleteMany({ user: userId, purpose })
  const generated = createSecurityToken()
  const hours = purpose === 'verify' ? 24 : 1
  await SecurityToken.create({ user: userId, purpose, tokenHash: generated.tokenHash, expiresAt: new Date(Date.now() + hours * 3600000) })
  return generated.token
}

export function mailStatus() {
  return { configured: false, delivered: false, reason: 'Email transport is not configured on this server.' }
}
