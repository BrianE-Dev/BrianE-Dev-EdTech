import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AuditLog, Certificate, Course, Payment, Pricing, Progress, User } from '../models/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { getFinalPrice } from '../utils/pricing.js'
import { initializeTransaction, verifyTransaction } from '../services/paystack.js'

const router = Router()
const sessionCookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 7 * 86400000 }
function pricingRegion(req) {
  const country = req.user?.country || req.get('cf-ipcountry') || req.get('x-vercel-ip-country')
  return country?.toUpperCase() === 'NG' ? 'NG' : 'INTL'
}

async function completePayment(payment, transaction) {
  const pricing = await Pricing.findOne({ region: payment.region })
  if (!pricing) throw Object.assign(new Error('Pricing configuration not found'), { status: 409 })
  if (transaction.status !== 'success' || transaction.reference !== payment.reference || transaction.amount !== Math.round(payment.amount * 100) || transaction.currency !== payment.currency || transaction.currency !== pricing.currency) {
    payment.status = 'failed'
    await payment.save()
    throw Object.assign(new Error('Payment amount or currency verification failed'), { status: 409 })
  }
  if (payment.status !== 'successful') {
    const updated = await Payment.findOneAndUpdate({ _id: payment.id, status: { $ne: 'successful' } }, { $set: { status: 'successful', transactionId: String(transaction.id), paidAt: transaction.paid_at ? new Date(transaction.paid_at) : new Date(), metadata: { channel: transaction.channel, ipAddress: transaction.ip_address } } }, { new: true })
    if (updated) Object.assign(payment, updated.toObject())
  }
  return payment
}

router.get('/health', (_req, res) => res.json({ ok: true }))

router.post('/auth/register', async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.email(), password: z.string().min(10).max(128), country: z.string().length(2).optional() })
  const input = schema.parse(req.body)
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), country: input.country?.toUpperCase(), currency: input.country?.toUpperCase() === 'NG' ? 'NGN' : 'USD' })
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('session', token, sessionCookie).status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

router.post('/auth/login', async (req, res) => {
  const input = z.object({ email: z.email(), password: z.string().min(1) }).parse(req.body)
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('session', token, sessionCookie).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

router.post('/auth/logout', (_req, res) => res.clearCookie('session', { ...sessionCookie, maxAge: undefined }).json({ ok: true }))
router.get('/auth/me', authenticate, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }))

router.get('/pricing', authenticateOptional, async (req, res) => {
  const region = pricingRegion(req)
  const config = await Pricing.findOne({ region })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  const { _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, promotionActive } = getFinalPrice(config)
  res.json({ id: _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, discountEnabled: promotionActive, promotionActive })
})

function authenticateOptional(req, _res, next) {
  const token = req.cookies?.session
  if (!token) return next()
  try { jwt.verify(token, process.env.JWT_SECRET, (error, payload) => { if (!error) User.findById(payload.sub).then((user) => { req.user = user; next() }).catch(next); else next() }) } catch { next() }
}

router.get('/courses', async (_req, res) => res.json(await Course.find({ published: true }).select('title slug description sections.title sections.chapters.title')))
router.get('/courses/:slug', async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, published: true })
  if (!course) return res.status(404).json({ error: 'Course not found' })
  res.json(course)
})

router.post('/payments/initialize', authenticate, async (req, res) => {
  const course = await Course.findOne({ slug: z.string().min(1).parse(req.body.courseSlug), published: true })
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const hasAccess = await Payment.exists({ user: req.user.id, course: course.id, status: 'successful' })
  if (hasAccess) return res.status(409).json({ error: 'Course already purchased' })
  const region = pricingRegion(req)
  const config = await Pricing.findOne({ region })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  const price = getFinalPrice(config)
  const reference = `BE-${crypto.randomUUID()}`
  const payment = await Payment.create({ user: req.user.id, course: course.id, reference, amount: price.currentPrice, currency: price.currency, originalPrice: price.originalPrice, discount: price.discount, region })
  try {
    const transaction = await initializeTransaction({ email: req.user.email, amount: Math.round(price.currentPrice * 100), currency: price.currency, reference, callback_url: `${process.env.CLIENT_URL}/?payment=return`, metadata: { userId: req.user.id, courseId: course.id } })
    res.json({ authorizationUrl: transaction.authorization_url, reference })
  } catch (error) { payment.status = 'failed'; await payment.save(); throw error }
})

router.post('/payments/verify', authenticate, async (req, res) => {
  const reference = z.string().min(6).max(100).parse(req.body.reference)
  const payment = await Payment.findOne({ reference, user: req.user.id })
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.json({ status: payment.status, courseId: payment.course })
})

router.post('/payments/paystack/webhook', async (req, res) => {
  const signature = req.get('x-paystack-signature')
  if (!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({ error: 'Webhook is not configured' })
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex')
  if (!signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid webhook signature' })
  if (req.body.event !== 'charge.success') return res.sendStatus(200)
  const reference = req.body.data?.reference
  const payment = await Payment.findOne({ reference })
  if (!payment) return res.status(404).json({ error: 'Payment reference not found' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.sendStatus(200)
})

router.get('/me/purchases', authenticate, async (req, res) => res.json(await Payment.find({ user: req.user.id, status: 'successful' }).populate('course', 'title slug')))
router.get('/courses/:courseId/lessons/:chapterId', authenticate, async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const access = await Payment.exists({ user: req.user.id, course: course.id, status: 'successful' })
  if (!access) return res.status(403).json({ error: 'Course purchase required' })
  const chapter = course.sections.flatMap((section, sectionIndex) => section.chapters.map((item, chapterIndex) => ({ item, sectionIndex, chapterIndex, id: `${sectionIndex}-${chapterIndex}` }))).find(({ id }) => id === req.params.chapterId)
  if (!chapter) return res.status(404).json({ error: 'Lesson not found' })
  res.json({ course: course.title, section: course.sections[chapter.sectionIndex].title, lesson: chapter.item })
})

router.post('/courses/:courseId/progress/:chapterId', authenticate, async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const purchased = await Payment.exists({ user: req.user.id, course: course.id, status: 'successful' })
  if (!purchased) return res.status(403).json({ error: 'Course purchase required' })
  const allChapters = course.sections.flatMap((section, sectionIndex) => section.chapters.map((_chapter, chapterIndex) => `${sectionIndex}-${chapterIndex}`))
  if (!allChapters.includes(req.params.chapterId)) return res.status(404).json({ error: 'Chapter not found' })
  const progress = await Progress.findOneAndUpdate({ user: req.user.id, course: course.id }, { $addToSet: { completedChapters: req.params.chapterId }, $set: { lastAccessedAt: new Date() } }, { upsert: true, new: true })
  progress.completionPercentage = allChapters.length ? Math.round(progress.completedChapters.length / allChapters.length * 10000) / 100 : 0
  if (progress.completionPercentage === 100 && course.certificateEligible) {
    progress.completedAt ||= new Date()
    await Certificate.findOneAndUpdate({ user: req.user.id, course: course.id }, { $setOnInsert: { certificateId: `BE-${crypto.randomUUID()}`, recipientName: req.user.name, courseTitle: course.title, issueDate: new Date(), completionDate: progress.completedAt, verificationStatus: 'valid' } }, { upsert: true, new: true })
  }
  await progress.save()
  res.json(progress)
})

router.get('/me/progress/:courseId', authenticate, async (req, res) => {
  const purchased = await Payment.exists({ user: req.user.id, course: req.params.courseId, status: 'successful' })
  if (!purchased) return res.status(403).json({ error: 'Course purchase required' })
  res.json(await Progress.findOne({ user: req.user.id, course: req.params.courseId }))
})

router.get('/me/certificates', authenticate, async (req, res) => res.json(await Certificate.find({ user: req.user.id, verificationStatus: 'valid' })))
router.get('/certificates/verify/:certificateId', async (req, res) => {
  const certificate = await Certificate.findOne({ certificateId: req.params.certificateId, verificationStatus: 'valid' }).select('certificateId recipientName courseTitle issueDate completionDate')
  if (!certificate) return res.status(404).json({ error: 'Certificate not found' })
  res.json(certificate)
})

router.get('/admin/pricing', authenticate, requireAdmin, async (_req, res) => res.json(await Pricing.find().sort({ region: 1 })))
router.put('/admin/pricing/:region', authenticate, requireAdmin, async (req, res) => {
  const region = z.enum(['NG', 'INTL']).parse(req.params.region)
  const schema = z.object({ originalPrice: z.number().positive(), discountType: z.enum(['percentage', 'fixed']), discountValue: z.number().min(0), discountEnabled: z.boolean(), active: z.boolean(), startDate: z.iso.datetime().nullable().optional(), endDate: z.iso.datetime().nullable().optional() })
  const input = schema.parse(req.body)
  if (input.discountType === 'percentage' && input.discountValue > 100) return res.status(400).json({ error: 'Percentage discount must be at most 100' })
  if (input.discountType === 'fixed' && input.discountValue > input.originalPrice) return res.status(400).json({ error: 'Fixed discount cannot exceed original price' })
  if (input.startDate && input.endDate && new Date(input.startDate) > new Date(input.endDate)) return res.status(400).json({ error: 'Promotion dates are invalid' })
  const previous = await Pricing.findOne({ region })
  if (!previous) return res.status(404).json({ error: 'Pricing region not found; run the seed command' })
  const previousValue = previous.toObject()
  Object.assign(previous, input, { updatedBy: req.user.id })
  await previous.save()
  await AuditLog.create({ admin: req.user.id, action: 'pricing.updated', resource: region, previousValue, newValue: previous.toObject() })
  res.json(previous)
})
router.get('/admin/transactions', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find().sort({ createdAt: -1 }).limit(500).populate('user', 'name email').populate('course', 'title')))
router.get('/admin/purchases', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find().sort({ createdAt: -1 }).populate('user', 'name email').populate('course', 'title').lean()))
router.get('/admin/certificates', authenticate, requireAdmin, async (_req, res) => res.json(await Certificate.find().sort({ issueDate: -1 }).populate('user', 'name email').populate('course', 'title')))

export default router
