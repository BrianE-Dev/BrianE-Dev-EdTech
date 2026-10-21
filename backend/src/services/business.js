import crypto from 'node:crypto'
import { BusinessContact, BusinessCounter, BusinessRequest, SecurityToken } from '../models/index.js'
import { getMailConfiguration, sendEnquiryAcknowledgement, sendEnquiryAdminNotification } from './email.js'

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
  if (input.submissionId) {
    const existing = await BusinessRequest.findOne({ submissionId: input.submissionId })
    if (existing) return existing
  }
  const reference = await nextReference(kind)
  let row
  try {
    row = await BusinessRequest.create({ ...input, kind, reference })
  } catch (error) {
    if (error.code !== 11000 || !input.submissionId) throw error
    row = await BusinessRequest.findOne({ submissionId: input.submissionId })
    if (!row) throw error
  }
  try {
    await BusinessContact.findOneAndUpdate(
      { email: input.email },
      { $setOnInsert: { name: input.name, email: input.email, company: input.company || '', source: kind } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    console.error(JSON.stringify({ event: 'business_contact_upsert_failed', errorCode: /^[A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : 'DATABASE_WRITE_FAILED' }))
  }
  return row
}

export function createSecurityToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') }
}

export async function consumeSecurityToken(token, purpose) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return SecurityToken.findOneAndDelete({ purpose, tokenHash, expiresAt: { $gt: new Date() } })
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
  const config = getMailConfiguration()
  return { configured: config.configured, state: config.configured ? 'ready' : 'not_configured', missing: config.missing }
}

export async function sendBusinessNotification(requestId, kind) {
  if (!['requester', 'admin'].includes(kind)) throw new Error('Unknown business notification type')
  const statusPath = `emailNotifications.${kind}Status`
  const errorPath = `emailNotifications.${kind}ErrorCode`
  const retryPath = `emailNotifications.${kind}RetryUntil`
  const now = new Date()
  const request = await BusinessRequest.findOneAndUpdate({
    _id: requestId,
    [statusPath]: { $nin: ['accepted', 'sending'] },
    $or: [{ [retryPath]: null }, { [retryPath]: { $lt: now } }],
  }, { $set: { [statusPath]: 'sending', [retryPath]: new Date(now.getTime() + 5 * 60 * 1000), [errorPath]: '' } }, { new: true })
  if (!request) return { state: 'skipped', accepted: false }

  const result = kind === 'requester'
    ? await sendEnquiryAcknowledgement(request)
    : await sendEnquiryAdminNotification(request)
  const state = result.state === 'accepted' ? 'accepted' : result.state
  await BusinessRequest.updateOne({ _id: requestId, [statusPath]: 'sending' }, {
    $set: { [statusPath]: state, [errorPath]: result.errorCode || '' },
    $unset: { [retryPath]: 1 },
  })
  return { state, accepted: result.accepted, errorCode: result.errorCode || '' }
}

export async function sendBusinessNotifications(requestId) {
  const [requester, admin] = await Promise.all([
    sendBusinessNotification(requestId, 'requester'),
    sendBusinessNotification(requestId, 'admin'),
  ])
  return { requester: requester.state, admin: admin.state }
}
