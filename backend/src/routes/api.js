import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AuditLog, Certificate, Course, Payment, Pricing, Progress, User } from '../models/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { getFinalPrice } from '../utils/pricing.js'
import { getPaystackConfig } from '../config/paystack.js'
import { initializeTransaction, verifyTransaction } from '../services/paystack.js'
import { curriculum, CURRICULUM_VERSION } from '../../../src/data/curriculum.js'
import { canAccessCourseLesson } from '../services/courseLessonAccess.js'
import { getLessonByChapterId, InvalidChapterError, InvalidLessonContentError, LessonNotFoundError } from '../services/lessonRepository.js'
import { toPublicLesson } from '../services/publicLesson.js'

const router = Router()
const isSecureCookie = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'
const sessionCookie = { httpOnly: true, secure: isSecureCookie, sameSite: isSecureCookie ? 'none' : 'strict', path: '/', maxAge: 7 * 86400000 }
const COURSE_SLUG = 'ai-powered-developer-productivity'
const COURSE_PRODUCT_ID = COURSE_SLUG

function pricingRegion(req) {
  const country = req.user?.country || (req.get('cf-ipcountry') !== 'XX' && req.get('cf-ipcountry')) || req.get('x-vercel-ip-country')
  return country?.toUpperCase() === 'NG' ? 'NG' : 'INTL'
}

async function completePayment(payment, transaction) {
  if (payment.application !== 'brianedev' || payment.productId !== COURSE_PRODUCT_ID || payment.productType !== 'course') throw Object.assign(new Error('Payment does not belong to a BrianE-Dev course'), { status: 409 })
  if (payment.provider !== 'paystack' || payment.environment !== getPaystackConfig().appEnvironment) throw Object.assign(new Error('Payment environment does not match this backend'), { status: 409 })
  if (transaction.status !== 'success' || transaction.reference !== payment.paystackReference || transaction.reference !== payment.reference || transaction.amount !== Math.round(payment.amount * 100) || transaction.currency !== payment.currency) {
    if (!['paid', 'successful'].includes(payment.status)) {
      payment.status = 'failed'
      await payment.save()
    }
    throw Object.assign(new Error('Payment amount or currency verification failed'), { status: 409 })
  }
  if (payment.status !== 'paid' && payment.status !== 'successful') {
    const updated = await Payment.findOneAndUpdate({ _id: payment.id, status: { $nin: ['paid', 'successful'] } }, { $set: { status: 'paid', transactionId: String(transaction.id), paystackTransactionId: String(transaction.id), paidAt: transaction.paid_at ? new Date(transaction.paid_at) : new Date(), metadata: { ...payment.metadata, channel: transaction.channel, ipAddress: transaction.ip_address } } }, { new: true })
    if (updated) Object.assign(payment, updated.toObject())
  }
  return payment
}

router.get('/health', (_req, res) => res.json({ ok: true }))

router.post('/auth/register', async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.email(), password: z.string().min(10).max(128) })
  const input = schema.parse(req.body)
  const country = (req.get('cf-ipcountry') !== 'XX' && req.get('cf-ipcountry')) || req.get('x-vercel-ip-country')
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), country: /^[A-Z]{2}$/i.test(country || '') ? country.toUpperCase() : undefined, currency: country?.toUpperCase() === 'NG' ? 'NGN' : 'USD' })
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

function publicCourseMetadata(course) {
  return {
    title: course.title,
    slug: course.slug,
    description: course.description || '',
    curriculumVersion: CURRICULUM_VERSION,
    sections: curriculum.sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      chapters: section.chapters.map((chapter) => ({
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        order: chapter.order,
      })),
    })),
  }
}

router.get('/courses', async (_req, res) => {
  const courses = await Course.find({ published: true }).select('title slug description').lean()
  res.json(courses.map(publicCourseMetadata))
})
router.get('/courses/:slug', async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, published: true }).select('title slug description').lean()
  if (!course) return res.status(404).json({ error: 'Course not found' })
  res.json(publicCourseMetadata(course))
})

async function initializeCoursePayment(req, res) {
  const { appEnvironment } = getPaystackConfig()
  const productId = z.string().min(1).parse(req.body.productId ?? req.body.courseSlug)
  if (productId !== COURSE_PRODUCT_ID) return res.status(404).json({ error: 'Product not found' })
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const hasAccess = await Payment.exists({ user: req.user.id, course: course.id, status: { $in: ['paid', 'successful'] }, application: 'brianedev', environment: appEnvironment })
  if (hasAccess) return res.status(409).json({ error: 'Course already purchased' })
  const region = pricingRegion(req)
  const config = await Pricing.findOne({ region })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  const price = getFinalPrice(config)
  const random = crypto.randomBytes(6).toString('hex').toUpperCase()
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const reference = `BDE-${date}-${random}`
  const regionName = region === 'NG' ? 'nigeria' : 'international'
  const metadata = {
    application: 'brianedev', application_name: 'BrianE-Dev', product_type: 'course', product_id: COURSE_PRODUCT_ID,
    product_name: course.title, user_id: req.user.id, region: regionName, currency: price.currency,
    pricing_id: String(config._id), environment: appEnvironment, source: 'brianedev_web',
  }
  const payment = await Payment.create({
    application: 'brianedev', environment: appEnvironment, provider: 'paystack', productType: 'course', productId: COURSE_PRODUCT_ID, productName: course.title,
    user: req.user.id, course: course.id, reference, paystackReference: reference, amount: price.currentPrice,
    currency: price.currency, originalPrice: price.originalPrice, originalAmount: price.originalPrice, discount: price.discount,
    discountAmount: price.discount, discountType: price.discountType, discountValue: price.discountValue,
    pricingId: config._id, region, metadata,
  })
  try {
    const transaction = await initializeTransaction({
      email: req.user.email, amount: Math.round(price.currentPrice * 100), currency: price.currency, reference,
      callback_url: `${process.env.CLIENT_URL}/?payment=return`,
      metadata: {
        ...metadata,
        course_id: String(course.id),
        custom_fields: [
          { display_name: 'Application', variable_name: 'application', value: 'BrianE-Dev' },
          { display_name: 'Product', variable_name: 'product', value: course.title },
          { display_name: 'User ID', variable_name: 'user_id', value: req.user.id },
          { display_name: 'Region', variable_name: 'region', value: regionName === 'nigeria' ? 'Nigeria' : 'International' },
        ],
      },
    })
    res.json({ authorizationUrl: transaction.authorization_url, reference })
  } catch (error) { payment.status = 'failed'; await payment.save(); throw error }
}

router.post('/payments/initialize', authenticate, initializeCoursePayment)
router.post('/brianedev/payments/initialize', authenticate, initializeCoursePayment)

async function verifyCoursePayment(req, res) {
  const reference = z.string().min(6).max(100).parse(req.body.reference)
  const filter = { reference, application: 'brianedev', environment: getPaystackConfig().appEnvironment }
  if (req.user) filter.user = req.user.id
  const payment = await Payment.findOne(filter)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.json({ status: payment.status, courseId: payment.course })
}
router.post('/payments/verify', authenticate, verifyCoursePayment)
router.post('/brianedev/payments/verify', authenticate, verifyCoursePayment)

async function paystackWebhook(req, res) {
  const signature = req.get('x-paystack-signature')
  const { webhookSecret, appEnvironment } = getPaystackConfig()
  const expected = crypto.createHmac('sha512', webhookSecret).update(req.rawBody).digest('hex')
  if (!signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid webhook signature' })
  if (req.body.event !== 'charge.success') return res.sendStatus(200)
  const reference = req.body.data?.reference
  const payment = await Payment.findOne({ reference, application: 'brianedev', environment: appEnvironment, provider: 'paystack', productId: COURSE_PRODUCT_ID })
  if (!payment) return res.status(404).json({ error: 'Payment reference not found' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.sendStatus(200)
}
router.post('/payments/paystack/webhook', paystackWebhook)
router.post('/brianedev/payments/paystack/webhook', paystackWebhook)

router.get('/me/purchases', authenticate, async (req, res) => res.json(await Payment.find({ user: req.user.id, application: 'brianedev', environment: getPaystackConfig().appEnvironment, status: { $in: ['paid', 'successful'] } }).populate('course', 'title slug')))
router.get('/courses/:courseId/lessons/:chapterId', authenticate, async (req, res, next) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) return res.status(404).json({ error: 'Course not found' })
  if (!(await canAccessCourseLesson(req.user, course))) return res.status(403).json({ error: 'Course purchase required' })

  try {
    const lesson = await getLessonByChapterId(req.params.chapterId)
    return res.json({ course: course.title, lesson: toPublicLesson(lesson) })
  } catch (error) {
    if (error instanceof InvalidChapterError) return res.status(404).json({ error: 'Lesson not found' })
    if (error instanceof LessonNotFoundError) return res.status(404).json({ error: 'Lesson content is not available' })
    if (error instanceof InvalidLessonContentError) {
      console.error(error.message)
      return res.status(500).json({ error: 'Lesson content is invalid' })
    }
    return next(error)
  }
})

router.post('/courses/:courseId/progress/:chapterId', authenticate, async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const purchased = await Payment.exists({ user: req.user.id, course: course.id, application: 'brianedev', environment: getPaystackConfig().appEnvironment, status: { $in: ['paid', 'successful'] } })
  if (!purchased) return res.status(403).json({ error: 'Course purchase required' })
  const allChapters = course.sections.flatMap((section, sectionIndex) => section.chapters.map((_chapter, chapterIndex) => `${sectionIndex}-${chapterIndex}`))
  if (!allChapters.includes(req.params.chapterId)) return res.status(404).json({ error: 'Chapter not found' })
  const progress = await Progress.findOneAndUpdate({ user: req.user.id, course: course.id }, { $addToSet: { completedChapters: req.params.chapterId }, $set: { lastAccessedChapter: req.params.chapterId, lastAccessedAt: new Date() } }, { upsert: true, new: true })
  progress.completionPercentage = allChapters.length ? Math.round(progress.completedChapters.length / allChapters.length * 10000) / 100 : 0
  if (progress.completionPercentage === 100 && course.certificateEligible) {
    progress.completedAt ||= new Date()
    await Certificate.findOneAndUpdate({ user: req.user.id, course: course.id }, { $setOnInsert: { certificateId: `BE-${crypto.randomUUID()}`, recipientName: req.user.name, courseTitle: course.title, issueDate: new Date(), completionDate: progress.completedAt, verificationStatus: 'valid' } }, { upsert: true, new: true })
  }
  await progress.save()
  res.json(progress)
})

router.get('/me/progress/:courseId', authenticate, async (req, res) => {
  const purchased = await Payment.exists({ user: req.user.id, course: req.params.courseId, application: 'brianedev', environment: getPaystackConfig().appEnvironment, status: { $in: ['paid', 'successful'] } })
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
  const schema = z.object({ region: z.enum(['NG', 'INTL']).optional(), currency: z.enum(['NGN', 'USD']).optional(), originalPrice: z.number().positive(), discountType: z.enum(['percentage', 'fixed']), discountValue: z.number().min(0), discountEnabled: z.boolean(), active: z.boolean(), startDate: z.iso.datetime().nullable().optional(), endDate: z.iso.datetime().nullable().optional() })
  const input = schema.parse(req.body)
  if (input.discountType === 'percentage' && input.discountValue > 100) return res.status(400).json({ error: 'Percentage discount must be at most 100' })
  if (input.discountType === 'fixed' && input.discountValue > input.originalPrice) return res.status(400).json({ error: 'Fixed discount cannot exceed original price' })
  const currency = input.currency || (region === 'NG' ? 'NGN' : 'USD')
  if ((region === 'NG' && currency !== 'NGN') || (region === 'INTL' && currency !== 'USD')) return res.status(400).json({ error: 'Nigeria prices must use NGN and international prices must use USD' })
  if (input.startDate && input.endDate && new Date(input.startDate) > new Date(input.endDate)) return res.status(400).json({ error: 'Promotion dates are invalid' })
  const previous = await Pricing.findOne({ region })
  if (!previous) return res.status(404).json({ error: 'Pricing region not found; run the seed command' })
  const previousValue = previous.toObject()
  Object.assign(previous, input, { region, currency, updatedBy: req.user.id })
  await previous.save()
  await AuditLog.create({ admin: req.user.id, action: 'pricing.updated', resource: region, previousValue, newValue: previous.toObject() })
  res.json(previous)
})
router.get('/admin/transactions', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find({ application: 'brianedev', environment: getPaystackConfig().appEnvironment }).sort({ createdAt: -1 }).limit(500).populate('user', 'name email').populate('course', 'title')))
router.get('/admin/purchases', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find({ application: 'brianedev', environment: getPaystackConfig().appEnvironment }).sort({ createdAt: -1 }).populate('user', 'name email').populate('course', 'title').lean()))
router.get('/admin/certificates', authenticate, requireAdmin, async (_req, res) => res.json(await Certificate.find().sort({ issueDate: -1 }).populate('user', 'name email').populate('course', 'title')))

export default router
