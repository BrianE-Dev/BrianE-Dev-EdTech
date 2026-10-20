import express, { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import mongoose from 'mongoose'
import { AuditLog, BusinessContact, BusinessRequest, Certificate, CertificateTemplate, Course, EmailCampaign, Payment, Pricing, Progress, SecurityToken, TtsAudio, User } from '../models/index.js'
import { authenticate, requireAdmin, requireVerified } from '../middleware/auth.js'
import { issueSecurityToken, mailStatus, saveBusinessRequest } from '../services/business.js'
import { getFinalPrice } from '../utils/pricing.js'
import { getPaystackConfig } from '../config/paystack.js'
import { initializeTransaction, verifyTransaction } from '../services/paystack.js'
import { curriculum, CURRICULUM_VERSION } from '../../../src/data/curriculum.js'
import { canAccessCourseLesson } from '../services/courseLessonAccess.js'
import { getLessonByChapterId, InvalidChapterError, InvalidLessonContentError, LessonNotFoundError, LessonRepositoryError } from '../services/lessonRepository.js'
import { toPublicLesson, toPublicPreviewLesson } from '../services/publicLesson.js'
import { acknowledgeRequiredExercise, CompletionRequirementsError, getCourseProgress, openLessonProgress, updateLessonProgress } from '../services/lessonCompletion.js'
import { InvalidAssessmentSubmissionError, submitLessonAssessment } from '../services/assessmentService.js'
import { LessonAssetNotFoundError, resolveLessonImage } from '../services/lessonAssetRepository.js'
import { getChapterMetadata } from '../services/curriculumNavigation.js'
import { CourseEbookNotFoundError, resolveCourseEbook } from '../services/courseEbookRepository.js'
import { createCertificatePdf } from '../services/certificatePdf.js'
import { generateChapterAudio, getCourseAudioStatus, isReadyChapterAudio, loadReadyChapterAudio, startCourseAudioBatch, writeOwnedTtsAudio } from '../services/ttsGeneration.js'
import { buildTtsTranscript, hashTranscript } from '../services/ttsTranscript.js'
import { isSuperAdmin } from '../utils/authorization.js'
import { createTtsStorage } from '../services/ttsStorage.js'
import { isDatabaseReady } from '../config/database.js'
import { diagnosticTokenMatches, getOutboundPublicIp } from '../services/hostingerDiagnostic.js'

const router = Router()
const isSecureCookie = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'
const sessionCookie = { httpOnly: true, secure: isSecureCookie, sameSite: isSecureCookie ? 'none' : 'strict', path: '/', maxAge: 7 * 86400000 }
const COURSE_SLUG = 'ai-powered-developer-productivity'
const COURSE_PRODUCT_ID = COURSE_SLUG

async function completePayment(payment, transaction) {
  if (payment.application !== 'brianedev' || payment.productId !== COURSE_PRODUCT_ID || payment.productType !== 'course') throw Object.assign(new Error('Payment does not belong to a BrianE-Dev course'), { status: 409 })
  if (payment.provider !== 'paystack' || payment.environment !== getPaystackConfig().appEnvironment || payment.region !== 'NG' || payment.currency !== 'NGN') throw Object.assign(new Error('Payment does not match the Nigerian Paystack purchase policy'), { status: 409 })
  if (transaction.reference !== payment.paystackReference || transaction.reference !== payment.reference) throw Object.assign(new Error('Payment reference verification failed'), { status: 409 })
  if (transaction.status !== 'success') {
    const pendingStatuses = ['pending', 'processing', 'ongoing', 'queued']
    if (!pendingStatuses.includes(transaction.status) && !['paid', 'successful'].includes(payment.status)) {
      payment.status = 'failed'
      await payment.save()
    }
    return payment
  }
  if (transaction.amount !== Math.round(payment.amount * 100) || transaction.currency !== payment.currency) {
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
router.get('/ready', (_req, res) => {
  const ready = isDatabaseReady()
  res.status(ready ? 200 : 503).json({ ok: ready, database: ready ? 'ready' : 'unavailable' })
})
router.get('/diagnostics/hostinger-network', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const expectedToken = process.env.HOSTINGER_DIAGNOSTIC_TOKEN
  const providedToken = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!diagnosticTokenMatches(providedToken, expectedToken)) {
    return res.status(expectedToken ? 401 : 404).json({ status: expectedToken ? 'unauthorized' : 'disabled' })
  }

  try {
    const publicIp = await getOutboundPublicIp()
    return res.json({ status: 'ok', publicIp })
  } catch {
    return res.status(502).json({ status: 'ip_check_failed', publicIp: null })
  }
})

router.post('/auth/register', async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().pipe(z.email()), password: z.string().min(10).max(128) })
  const input = schema.parse(req.body)
  const existingUser = await User.findOne({ email: input.email }).select('_id')
  if (existingUser) return res.status(409).json({ error: 'An account already exists for this email. Please sign in.' })
  const paidAccess = await Payment.findOne({ application: 'brianedev', environment: getPaystackConfig().appEnvironment, productId: COURSE_PRODUCT_ID, productType: 'course', status: { $in: ['paid', 'successful'] }, $or: [{ checkoutEmail: input.email }, ...(existingUser ? [{ user: existingUser._id }] : [])] })
  if (!paidAccess) return res.status(403).json({ error: 'Complete payment successfully with this email before creating your learner account.' })
  const country = (req.get('cf-ipcountry') !== 'XX' && req.get('cf-ipcountry')) || req.get('x-vercel-ip-country')
  const user = await User.create({ name: input.name, email: input.email, emailVerified: false, passwordHash: await bcrypt.hash(input.password, 12), country: /^[A-Z]{2}$/i.test(country || '') ? country.toUpperCase() : undefined, currency: country?.toUpperCase() === 'NG' ? 'NGN' : 'USD' })
  await Payment.updateMany({ $or: [{ checkoutEmail: input.email }, ...(existingUser ? [{ user: existingUser._id }] : [])], application: 'brianedev', environment: getPaystackConfig().appEnvironment, productId: COURSE_PRODUCT_ID, status: { $in: ['paid', 'successful'] } }, { $set: { user: user._id, checkoutEmail: input.email } })
  const verificationToken = await issueSecurityToken(user, 'verify')
  res.status(201).json({ verificationRequired: true, emailDelivery: mailStatus(), ...(process.env.NODE_ENV !== 'production' ? { developmentVerificationToken: verificationToken } : {}) })
})

router.post('/auth/login', async (req, res) => {
  const input = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), password: z.string().min(1) }).parse(req.body)
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  if (!user || typeof user.passwordHash !== 'string' || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (!(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
  if (user.disabledAt) return res.status(403).json({ error: 'This learner account has been disabled.' })
  const token = jwt.sign({ sub: user.id, version: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('session', token, sessionCookie).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.role === 'super_admin' || user.emailVerified !== false } })
})

router.post('/auth/verify-email', async (req, res) => {
  const token = z.string().min(32).max(128).parse(req.body.token)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const stored = await SecurityToken.findOne({ purpose: 'verify', tokenHash, expiresAt: { $gt: new Date() } })
  if (!stored) return res.status(400).json({ error: 'Verification link is invalid or expired.' })
  await User.updateOne({ _id: stored.user }, { $set: { emailVerified: true } })
  await stored.deleteOne()
  res.json({ verified: true })
})

router.post('/auth/resend-verification', async (req, res) => {
  const email = z.string().trim().toLowerCase().pipe(z.email()).parse(req.body.email)
  const user = await User.findOne({ email, role: 'user', emailVerified: false })
  const token = user ? await issueSecurityToken(user, 'verify') : crypto.randomBytes(32).toString('base64url')
  res.json({ ok: true, emailDelivery: mailStatus(), ...(process.env.NODE_ENV !== 'production' ? { developmentVerificationToken: token } : {}) })
})

router.post('/auth/forgot-password', async (req, res) => {
  const email = z.string().trim().toLowerCase().pipe(z.email()).parse(req.body.email)
  const user = await User.findOne({ email, role: 'user' })
  const token = user ? await issueSecurityToken(user, 'reset') : crypto.randomBytes(32).toString('base64url')
  res.json({ ok: true, emailDelivery: mailStatus(), ...(process.env.NODE_ENV !== 'production' ? { developmentResetToken: token } : {}) })
})

router.post('/auth/reset-password', async (req, res) => {
  const input = z.object({ token: z.string().min(32).max(128), password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }).parse(req.body)
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex')
  const stored = await SecurityToken.findOne({ purpose: 'reset', tokenHash, expiresAt: { $gt: new Date() } })
  if (!stored) return res.status(400).json({ error: 'Reset link is invalid or expired.' })
  const passwordHash = await bcrypt.hash(input.password, 12)
  await User.updateOne({ _id: stored.user }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } })
  await SecurityToken.deleteMany({ user: stored.user, purpose: 'reset' })
  res.json({ ok: true, message: 'Password updated. Sign in with your new password.' })
})

router.post('/auth/logout', (_req, res) => res.clearCookie('session', { ...sessionCookie, maxAge: undefined }).json({ ok: true }))
router.get('/auth/me', authenticate, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, emailVerified: req.user.role === 'super_admin' || req.user.emailVerified !== false } }))

const requestSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: z.string().trim().max(40).optional().default(''), company: z.string().trim().max(160).optional().default(''),
  website: z.string().trim().max(300).optional().default('').refine((value) => { if (!value) return true; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) } catch { return false } }, 'Enter a valid website URL'), subject: z.string().trim().max(160).optional().default(''),
  message: z.string().trim().min(10).max(5000), privacyAccepted: z.literal(true),
  projectType: z.string().trim().max(100).optional(), requiredFeatures: z.array(z.string().trim().max(120)).max(30).optional().default([]),
  budget: z.string().trim().max(100).optional(), timeline: z.string().trim().max(100).optional(), notes: z.string().trim().max(3000).optional().default(''), marketingConsent: z.boolean().optional().default(false),
})
router.post('/business/enquiries', async (req, res) => {
  const input = requestSchema.parse(req.body)
  if (!input.subject) return res.status(400).json({ error: 'Enquiry subject is required.' })
  const row = await saveBusinessRequest('enquiry', { name: input.name, email: input.email, phone: input.phone, company: input.company, website: input.website, subject: input.subject, message: input.message })
  res.status(201).json({ saved: true, reference: row.reference, emailDelivery: mailStatus() })
})
router.post('/business/quotes', async (req, res) => {
  const input = requestSchema.parse(req.body)
  if (!input.projectType) return res.status(400).json({ error: 'Project type is required.' })
  const row = await saveBusinessRequest('quote', { name: input.name, email: input.email, phone: input.phone, company: input.company, website: input.website, subject: input.projectType || 'Project quote', message: input.message, details: { projectType: input.projectType || '', requiredFeatures: input.requiredFeatures, budget: input.budget || '', timeline: input.timeline || '', notes: input.notes, marketingConsent: input.marketingConsent } })
  if (input.marketingConsent) await BusinessContact.updateOne({ email: input.email, unsubscribedAt: null }, { $set: { marketingConsent: true, marketingConsentAt: new Date(), marketingConsentSource: 'quote-request', marketingPolicyVersion: '2026-10' } })
  res.status(201).json({ saved: true, reference: row.reference, emailDelivery: mailStatus() })
})

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).default(''),
  dateOfBirth: z.string().trim().max(10).refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value), 'Enter a valid date of birth'),
  gender: z.enum(['', 'female', 'male', 'non_binary', 'prefer_not_to_say']).default(''),
  country: z.string().trim().max(100).default(''),
  state: z.string().trim().max(100).default(''),
  city: z.string().trim().max(100).default(''),
  address: z.string().trim().max(240).default(''),
  occupation: z.string().trim().max(120).default(''),
  organization: z.string().trim().max(120).default(''),
}).strict()

function publicLearnerProfile(user) {
  return {
    name: user.name,
    email: user.email,
    profile: {
      phone: user.profile?.phone || '',
      dateOfBirth: user.profile?.dateOfBirth || '',
      gender: user.profile?.gender || '',
      country: user.profile?.country || '',
      state: user.profile?.state || '',
      city: user.profile?.city || '',
      address: user.profile?.address || '',
      occupation: user.profile?.occupation || '',
      organization: user.profile?.organization || '',
    },
  }
}

router.get('/me/profile', authenticate, (req, res) => res.json(publicLearnerProfile(req.user)))
router.put('/me/profile', authenticate, async (req, res) => {
  const { name, ...profile } = profileSchema.parse(req.body)
  const user = await User.findByIdAndUpdate(req.user.id, { $set: { name, profile } }, { new: true, runValidators: true })
  res.json(publicLearnerProfile(user))
})

router.get('/pricing', authenticateOptional, async (req, res) => {
  const config = await Pricing.findOne({ region: 'NG' })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  if (config.currency !== 'NGN') return res.status(503).json({ error: 'Nigerian pricing must be configured in NGN' })
  const { _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, promotionActive, startDate, endDate } = getFinalPrice(config)
  res.set('Cache-Control', 'no-store')
  res.json({ id: _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, discountEnabled: promotionActive, promotionActive, startDate: startDate || null, endDate: endDate || null })
})

function authenticateOptional(req, _res, next) {
  const token = req.cookies?.session
  if (!token) return next()
  try { jwt.verify(token, process.env.JWT_SECRET, (error, payload) => { if (!error) User.findById(payload.sub).then((user) => { req.user = user?.disabledAt ? null : user; next() }).catch(next); else next() }) } catch { next() }
}

function publicCourseMetadata(course) {
  return {
    id: String(course._id || course.id),
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

router.get('/courses', authenticateOptional, async (req, res) => {
  const filter = isSuperAdmin(req.user) ? {} : { published: true }
  const courses = await Course.find(filter).select('title slug description').lean()
  res.json(courses.map(publicCourseMetadata))
})
router.get('/courses/:slug', authenticateOptional, async (req, res) => {
  const filter = { slug: req.params.slug, ...(isSuperAdmin(req.user) ? {} : { published: true }) }
  const course = await Course.findOne(filter).select('title slug description').lean()
  if (!course) return res.status(404).json({ error: 'Course not found' })
  res.json(publicCourseMetadata(course))
})

async function initializeCoursePayment(req, res) {
  const { appEnvironment } = getPaystackConfig()
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const hasAccess = await Payment.exists({ user: req.user.id, course: course.id, status: { $in: ['paid', 'successful'] }, application: 'brianedev', environment: appEnvironment })
  if (hasAccess) return res.status(409).json({ error: 'Course already purchased' })
  const region = 'NG'
  const config = await Pricing.findOne({ region })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  if (config.currency !== 'NGN') return res.status(503).json({ error: 'Nigerian pricing must be configured in NGN' })
  const price = getFinalPrice(config)
  const random = crypto.randomBytes(6).toString('hex').toUpperCase()
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const reference = `BDE-${date}-${random}`
  const regionName = 'nigeria'
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
          { display_name: 'Region', variable_name: 'region', value: 'Nigeria' },
        ],
      },
    })
    res.json({ authorizationUrl: transaction.authorization_url, reference })
  } catch (error) { payment.status = 'failed'; await payment.save(); throw error }
}

router.post('/brianedev/payments/initialize-public', async (req, res) => {
  const input = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }).parse(req.body)
  const { appEnvironment } = getPaystackConfig()
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course) return res.status(404).json({ error: 'Course not found' })
  const existingUser = await User.findOne({ email: input.email })
  if (existingUser && await Payment.exists({ user: existingUser._id, course: course._id, status: { $in: ['paid', 'successful'] }, application: 'brianedev', environment: appEnvironment })) return res.status(409).json({ error: 'This email already has course access. Please sign in.' })
  const config = await Pricing.findOne({ region: 'NG' })
  if (!config || config.currency !== 'NGN') return res.status(503).json({ error: 'Nigerian pricing is not configured' })
  const price = getFinalPrice(config)
  const reference = `BDE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
  const metadata = { application: 'brianedev', application_name: 'BrianE-Dev', product_type: 'course', product_id: COURSE_PRODUCT_ID, product_name: course.title, checkout_email: input.email, region: 'nigeria', currency: price.currency, environment: appEnvironment, source: 'brianedev_web' }
  const payment = await Payment.create({ application: 'brianedev', environment: appEnvironment, provider: 'paystack', productType: 'course', productId: COURSE_PRODUCT_ID, productName: course.title, checkoutEmail: input.email, ...(existingUser ? { user: existingUser._id } : {}), course: course._id, reference, paystackReference: reference, amount: price.currentPrice, currency: price.currency, originalPrice: price.originalPrice, originalAmount: price.originalPrice, discount: price.discount, discountAmount: price.discount, discountType: price.discountType, discountValue: price.discountValue, pricingId: config._id, region: 'NG', metadata })
  try {
    const transaction = await initializeTransaction({ email: input.email, amount: Math.round(price.currentPrice * 100), currency: price.currency, reference, callback_url: `${process.env.CLIENT_URL}/?payment=return`, metadata: { ...metadata, course_id: String(course._id) } })
    res.json({ authorizationUrl: transaction.authorization_url, reference })
  } catch (error) { payment.status = 'failed'; await payment.save(); throw error }
})

router.post('/brianedev/payments/verify-public', async (req, res) => {
  const reference = z.string().min(6).max(100).parse(req.body.reference)
  const payment = await Payment.findOne({ reference, application: 'brianedev', environment: getPaystackConfig().appEnvironment, provider: 'paystack', productType: 'course', productId: COURSE_PRODUCT_ID, region: 'NG', currency: 'NGN' })
  if (!payment) return res.status(404).json({ error: 'Payment reference not found' })
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course || String(payment.course) !== String(course._id)) return res.status(409).json({ error: 'Payment course association is invalid' })
  await completePayment(payment, await verifyTransaction(reference))
  res.json({ status: ['paid', 'successful'].includes(payment.status) ? 'paid' : payment.status === 'failed' ? 'failed' : 'pending', courseId: payment.course })
})

router.post('/payments/initialize', authenticate, requireVerified, initializeCoursePayment)
router.post('/brianedev/payments/initialize', authenticate, requireVerified, initializeCoursePayment)

async function verifyCoursePayment(req, res) {
  const reference = z.string().min(6).max(100).parse(req.body.reference)
  const filter = { reference, application: 'brianedev', environment: getPaystackConfig().appEnvironment, provider: 'paystack', productType: 'course', productId: COURSE_PRODUCT_ID, region: 'NG', currency: 'NGN', user: req.user.id }
  const payment = await Payment.findOne(filter)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course || String(payment.course) !== String(course._id || course.id)) return res.status(409).json({ error: 'Payment course association is invalid' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.json({ status: payment.status === 'paid' || payment.status === 'successful' ? 'paid' : payment.status === 'failed' ? 'failed' : 'pending', courseId: payment.course })
}
router.post('/payments/verify', authenticate, requireVerified, verifyCoursePayment)
router.post('/brianedev/payments/verify', authenticate, requireVerified, verifyCoursePayment)

async function paystackWebhook(req, res) {
  const signature = req.get('x-paystack-signature')
  const { secretKey, appEnvironment } = getPaystackConfig()
  if (!Buffer.isBuffer(req.rawBody)) return res.status(400).json({ error: 'Webhook request body is invalid' })
  const expected = crypto.createHmac('sha512', secretKey).update(req.rawBody).digest('hex')
  if (!signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid webhook signature' })
  if (req.body.event !== 'charge.success') return res.sendStatus(200)
  const reference = req.body.data?.reference
  const payment = await Payment.findOne({ reference, application: 'brianedev', environment: appEnvironment, provider: 'paystack', productType: 'course', productId: COURSE_PRODUCT_ID, region: 'NG', currency: 'NGN' })
  if (!payment) return res.status(404).json({ error: 'Payment reference not found' })
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true })
  if (!course || String(payment.course) !== String(course._id || course.id)) return res.status(409).json({ error: 'Payment course association is invalid' })
  const transaction = await verifyTransaction(reference)
  await completePayment(payment, transaction)
  res.sendStatus(200)
}
router.post('/payments/paystack/webhook', paystackWebhook)
router.post('/brianedev/payments/paystack/webhook', paystackWebhook)

router.get('/me/purchases', authenticate, async (req, res) => res.json(await Payment.find({ user: req.user.id, application: 'brianedev', environment: getPaystackConfig().appEnvironment, status: { $in: ['paid', 'successful'] } }).populate('course', 'title slug')))
function apiFailure(res, status, message, code) {
  return res.status(status).json({ error: message, code })
}

async function findCourse(courseId) {
  if (!mongoose.isValidObjectId(courseId)) return null
  return Course.findById(courseId)
}

async function getPaidCourse(req, res) {
  if (req.user?.role !== 'super_admin' && req.user?.emailVerified === false) {
    apiFailure(res, 403, 'Verify your email address to access protected course content.', 'EMAIL_VERIFICATION_REQUIRED')
    return null
  }
  const course = await findCourse(req.params.courseId)
  if (!course) {
    apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
    return null
  }
  if (!(await canAccessCourseLesson(req.user, course))) {
    apiFailure(res, 403, 'Purchase the course to continue.', 'COURSE_PURCHASE_REQUIRED')
    return null
  }
  return course
}

async function loadCanonicalLesson(chapterId, res) {
  try {
    return await getLessonByChapterId(chapterId)
  } catch (error) {
    if (error instanceof InvalidChapterError || error instanceof LessonNotFoundError) {
      apiFailure(res, 404, error instanceof InvalidChapterError ? 'Lesson not found' : 'Lesson content is not available', 'LESSON_NOT_FOUND')
      return null
    }
    if (error instanceof InvalidLessonContentError) {
      console.error(error.message)
      apiFailure(res, 500, 'Lesson content is invalid', 'SERVER_ERROR')
      return null
    }
    if (error instanceof LessonRepositoryError) {
      console.error(error.message)
      apiFailure(res, 500, 'Unable to load lesson content', 'SERVER_ERROR')
      return null
    }
    throw error
  }
}

function progressState(progress, chapterId) {
  const state = progress.chapterProgress?.find((item) => item.chapterId === chapterId)
  const summary = progress.canonicalCompletionPercentage || 0
  return {
    status: state?.status || 'in_progress',
    startedAt: state?.startedAt || null,
    completedAt: state?.completedAt || null,
    percent: summary,
    requiredExerciseAcknowledgments: [...(state?.requiredExerciseAcknowledgments || [])],
  }
}

router.get('/courses/:slug/lessons/:chapterId/preview', authenticateOptional, async (req, res, next) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug, published: true }).select('title slug').lean()
    if (!course) return apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
    const isPurchased = await canAccessCourseLesson(req.user, course)
    if (req.params.chapterId !== 'chapter-ai-assisted-developer') {
      return apiFailure(res, 403, 'Purchase the course to continue.', 'COURSE_PURCHASE_REQUIRED')
    }
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    if (!lesson.preview) {
      return apiFailure(res, 403, 'Purchase the course to continue.', 'COURSE_PURCHASE_REQUIRED')
    }
    const metadata = getChapterMetadata(lesson.chapterId)
    res.json({
      course: course.title,
      lesson: toPublicPreviewLesson(lesson),
      ...metadata,
      progress: null,
      access: { level: 'preview', isPreview: true, isPurchased, purchaseRequired: false },
    })
  } catch (error) { next(error) }
})

router.get('/courses/:courseId/lessons/:chapterId/audio/status', authenticate, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const available = await isReadyChapterAudio(String(course._id || course.id), lesson)
    res.json({ available, status: available ? 'ready' : 'missing' })
  } catch (error) { next(error) }
})

router.get('/courses/:courseId/lessons/:chapterId/audio', authenticate, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const audio = await loadReadyChapterAudio(String(course._id || course.id), lesson)
    if (!audio) return apiFailure(res, 404, 'Lesson audio has not been generated yet.', 'AUDIO_NOT_GENERATED')
    res.set({ 'Content-Type': audio.mimeType, 'Content-Length': String(audio.buffer.length), 'Cache-Control': 'private, max-age=3600' })
    res.send(audio.buffer)
  } catch (error) { next(error) }
})

router.get('/courses/:courseId/lessons/:chapterId', authenticateOptional, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const metadata = getChapterMetadata(lesson.chapterId)
    const privileged = isSuperAdmin(req.user)
    const progress = privileged ? null : await openLessonProgress({ user: req.user, course, chapterId: lesson.chapterId })
    res.json({
      course: course.title,
      lesson: toPublicLesson(lesson),
      ...metadata,
      progress: privileged ? null : progressState(progress, lesson.chapterId),
      access: { level: 'full', isPreview: false, isPurchased: true, purchaseRequired: false, isSuperAdmin: privileged },
    })
  } catch (error) { next(error) }
})

router.get('/courses/:courseId/progress', authenticate, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    res.json(await getCourseProgress({ user: req.user, course }))
  } catch (error) { next(error) }
})

const progressRequestSchema = z.object({ status: z.enum(['in_progress', 'completed']) }).strict()

async function updateProgressRoute(req, res, next, forcedStatus = null) {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const parsed = forcedStatus ? { success: true, data: { status: forcedStatus } } : progressRequestSchema.safeParse(req.body)
    if (!parsed.success) return apiFailure(res, 400, 'Progress status is invalid', 'INVALID_PROGRESS')
    const result = await updateLessonProgress({ user: req.user, course, lesson, status: parsed.data.status })
    res.json({
      chapterId: lesson.chapterId,
      status: result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId).status,
      startedAt: result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId).startedAt,
      completedAt: result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId).completedAt,
      completionPercentage: result.progress.canonicalCompletionPercentage,
      courseCompleted: result.courseCompleted,
      certificateAvailable: result.courseCompleted && Boolean(course.certificateEligible),
      certificate: result.certificate ? {
        certificateId: result.certificate.certificateId,
        recipientName: result.certificate.recipientName,
        courseTitle: result.certificate.courseTitle,
        issueDate: result.certificate.issueDate,
      } : null,
    })
  } catch (error) {
    if (error instanceof CompletionRequirementsError) return apiFailure(res, 409, error.message, 'COMPLETION_REQUIREMENTS_UNMET')
    next(error)
  }
}

router.post('/courses/:courseId/lessons/:chapterId/progress', authenticate, updateProgressRoute)

router.post('/courses/:courseId/lessons/:chapterId/exercises/:exerciseId/complete', authenticate, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const result = await acknowledgeRequiredExercise({ user: req.user, course, lesson, exerciseId: req.params.exerciseId })
    if (!result.found) return apiFailure(res, 404, 'Exercise not found', 'EXERCISE_NOT_FOUND')
    if (!result.required) return res.json({ exerciseId: req.params.exerciseId, required: false, acknowledged: false })
    const state = result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId)
    res.json({ exerciseId: req.params.exerciseId, required: true, acknowledged: true, status: state.status, completedAt: state.completedAt || null, completionPercentage: result.progress.canonicalCompletionPercentage })
  } catch (error) { next(error) }
})

router.post('/courses/:courseId/lessons/:chapterId/assessment', authenticate, async (req, res, next) => {
  try {
    if (isSuperAdmin(req.user)) return apiFailure(res, 403, 'Super Admin can read the course but cannot submit learner assessments.', 'ADMIN_ASSESSMENT_DISABLED')
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const result = await submitLessonAssessment({ user: req.user, course, lesson, body: req.body })
    res.status(201).json({
      chapterId: lesson.chapterId,
      assessment: result.assessment,
      progress: result.progress ? {
        status: result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId).status,
        completedAt: result.progress.chapterProgress.find((item) => item.chapterId === lesson.chapterId).completedAt || null,
        completionPercentage: result.progress.canonicalCompletionPercentage,
      } : null,
      certificate: result.completion?.certificate ? {
        certificateId: result.completion.certificate.certificateId,
        recipientName: result.completion.certificate.recipientName,
        courseTitle: result.completion.certificate.courseTitle,
        issueDate: result.completion.certificate.issueDate,
      } : null,
    })
  } catch (error) {
    if (error instanceof InvalidAssessmentSubmissionError) {
      const status = error.code === 'ASSESSMENT_NOT_FOUND' ? 404 : 400
      return apiFailure(res, status, error.message, error.code)
    }
    next(error)
  }
})

router.get('/courses/:courseId/lessons/:chapterId/assets', authenticateOptional, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const asset = await resolveLessonImage(req.params.chapterId, req.query.src)
    res.type(asset.extension).sendFile(asset.path)
  } catch (error) {
    if (error instanceof InvalidChapterError || error instanceof LessonNotFoundError || error instanceof LessonAssetNotFoundError) {
      return apiFailure(res, 404, 'Lesson image is not available', 'LESSON_ASSET_NOT_FOUND')
    }
    if (error instanceof InvalidLessonContentError || error instanceof LessonRepositoryError) {
      console.error(error.message)
      return apiFailure(res, 500, 'Lesson content is invalid', 'SERVER_ERROR')
    }
    next(error)
  }
})

router.get('/courses/:courseId/ebook/status', async (req, res, next) => {
  try {
    const course = await findCourse(req.params.courseId)
    if (!course) return apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
    try {
      await resolveCourseEbook()
      return res.json({ available: true, title: 'BrianE-Dev Course Ebook' })
    } catch (error) {
      if (error instanceof CourseEbookNotFoundError) return res.json({ available: false, title: 'BrianE-Dev Course Ebook' })
      throw error
    }
  } catch (error) { next(error) }
})

router.get('/courses/:courseId/ebook', authenticateOptional, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const ebook = await resolveCourseEbook()
    res.download(ebook.path, ebook.filename)
  } catch (error) {
    if (error instanceof CourseEbookNotFoundError) return apiFailure(res, 404, error.message, 'EBOOK_UNAVAILABLE')
    next(error)
  }
})

router.post('/courses/:courseId/progress/:chapterId', authenticate, (req, res, next) => updateProgressRoute(req, res, next, 'completed'))

router.get('/me/progress/:courseId', authenticate, async (req, res) => {
  const purchased = await Payment.exists({ user: req.user.id, course: req.params.courseId, application: 'brianedev', environment: getPaystackConfig().appEnvironment, status: { $in: ['paid', 'successful'] } })
  if (!purchased) return res.status(403).json({ error: 'Course purchase required' })
  res.json(await Progress.findOne({ user: req.user.id, course: req.params.courseId }))
})

router.get('/me/certificates', authenticate, async (req, res) => {
  const course = await Course.findOne({ slug: COURSE_SLUG, published: true }).select('title slug certificateEligible').lean()
  if (!course) return apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
  if (!(await canAccessCourseLesson(req.user, course))) return apiFailure(res, 403, 'Purchase the course to access certificate records.', 'COURSE_PURCHASE_REQUIRED')
  const progress = await getCourseProgress({ user: req.user, course })
  if (!course.certificateEligible || progress.completedChapters !== progress.totalChapters) return res.json([])
  res.json(await Certificate.find({ user: req.user.id, course: course.id || course._id, verificationStatus: 'valid' }))
})
router.get('/certificates/verify/:certificateId', async (req, res) => {
  const certificate = await Certificate.findOne({ certificateId: req.params.certificateId, verificationStatus: 'valid' }).select('certificateId recipientName courseTitle issueDate verificationStatus')
  if (!certificate) return res.status(404).json({ error: 'Certificate not found' })
  res.json({
    certificateId: certificate.certificateId,
    status: certificate.verificationStatus,
    learnerName: certificate.recipientName,
    courseTitle: certificate.courseTitle,
    issueDate: certificate.issueDate,
  })
})

router.get('/me/certificates/:certificateId/download', authenticate, async (req, res, next) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId, verificationStatus: 'valid' })
      .select('certificateId recipientName courseTitle issueDate user course verificationStatus')
    if (!certificate) return apiFailure(res, 404, 'Certificate not found.', 'CERTIFICATE_NOT_FOUND')
    if (String(certificate.user) !== req.user.id) return apiFailure(res, 403, 'Certificate access denied.', 'CERTIFICATE_ACCESS_DENIED')
    const course = await findCourse(certificate.course)
    if (!course || !(await canAccessCourseLesson(req.user, course))) return apiFailure(res, 403, 'Purchase the course to download its certificate.', 'COURSE_PURCHASE_REQUIRED')
    const progress = await getCourseProgress({ user: req.user, course })
    if (!course.certificateEligible || progress.completedChapters !== progress.totalChapters) {
      return apiFailure(res, 403, 'Complete all course requirements before downloading the certificate.', 'CERTIFICATE_NOT_ELIGIBLE')
    }
    const clientUrl = process.env.CLIENT_URL?.split(',').map((origin) => origin.trim()).find(Boolean) || 'http://localhost:5173'
    const verificationUrl = new URL(`/api/certificates/verify/${encodeURIComponent(certificate.certificateId)}`, clientUrl).toString()
    const template = await CertificateTemplate.findOne({ key: 'global' }).lean() || {}
    const pdf = createCertificatePdf(certificate, verificationUrl, template)
    const safeId = certificate.certificateId.replace(/[^a-z0-9-]/gi, '')
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="BrianE-Dev-Certificate-${safeId}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(pdf)
  } catch (error) { next(error) }
})

router.get('/admin/business/overview', authenticate, requireAdmin, async (_req, res) => {
  const [users, unverifiedUsers, enquiries, quotes, unassigned, contacts, campaigns, recentRequests] = await Promise.all([
    User.countDocuments(), User.countDocuments({ emailVerified: false, role: 'user' }), BusinessRequest.countDocuments({ kind: 'enquiry' }),
    BusinessRequest.countDocuments({ kind: 'quote' }), BusinessRequest.countDocuments({ status: 'New' }), BusinessContact.countDocuments(),
    EmailCampaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), BusinessRequest.find().sort({ createdAt: -1 }).limit(8).select('-internalNotes').lean(),
  ])
  res.json({ users, unverifiedUsers, enquiries, quotes, unassigned, contacts, campaigns: Object.fromEntries(campaigns.map(({ _id, count }) => [_id, count])), recentRequests })
})
router.get('/admin/business/requests', authenticate, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25))
  const filter = {}
  if (['enquiry', 'quote'].includes(req.query.kind)) filter.kind = req.query.kind
  if (req.query.status) filter.status = z.enum(['New', 'Under Review', 'Awaiting Customer', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Closed']).parse(req.query.status)
  if (req.query.search) { const safe = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ reference: new RegExp(safe, 'i') }, { name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }, { company: new RegExp(safe, 'i') }] }
  const [rows, total] = await Promise.all([BusinessRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('internalNotes.author', 'name').lean(), BusinessRequest.countDocuments(filter)])
  res.json({ rows, total, page, pages: Math.ceil(total / limit) })
})
router.patch('/admin/business/requests/:id', authenticate, requireAdmin, async (req, res) => {
  const input = z.object({ status: z.enum(['New', 'Under Review', 'Awaiting Customer', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Closed']).optional(), note: z.string().trim().min(1).max(4000).optional() }).refine((value) => value.status || value.note).parse(req.body)
  const row = await BusinessRequest.findById(req.params.id)
  if (!row) return res.status(404).json({ error: 'Request not found' })
  if (input.status && input.status !== row.status) { row.status = input.status; row.statusHistory.push({ status: input.status, changedBy: req.user.id }) }
  if (input.note) row.internalNotes.push({ body: input.note, author: req.user.id })
  await row.save()
  res.json({ id: row.id, reference: row.reference, status: row.status, internalNotes: row.internalNotes })
})
router.get('/admin/business/requests.csv', authenticate, requireAdmin, async (_req, res) => {
  const rows = await BusinessRequest.find().sort({ createdAt: -1 }).limit(5000).lean()
  const cell = (value) => { const safe = String(value ?? '').replace(/[\r\n]/g, ' '); return `"${(/^[=+\-@\t]/.test(safe) ? `'${safe}` : safe).replaceAll('"', '""')}"` }
  res.type('text/csv').attachment('briane-dev-requests.csv').send(['Reference,Type,Name,Email,Company,Subject,Status,Created', ...rows.map((row) => [row.reference, row.kind, row.name, row.email, row.company, row.subject, row.status, row.createdAt?.toISOString()].map(cell).join(','))].join('\n'))
})
router.get('/admin/business/contacts', authenticate, requireAdmin, async (req, res) => {
  const filter = req.query.search ? { $or: [{ email: new RegExp(String(req.query.search).slice(0, 80), 'i') }, { name: new RegExp(String(req.query.search).slice(0, 80), 'i') }, { company: new RegExp(String(req.query.search).slice(0, 80), 'i') }] } : {}
  res.json(await BusinessContact.find(filter).sort({ updatedAt: -1 }).limit(500).lean())
})
router.patch('/admin/business/contacts/:id', authenticate, requireAdmin, async (req, res) => {
  const input = z.object({ leadStatus: z.enum(['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Converted', 'Not Proceeding']).optional(), note: z.string().trim().min(1).max(4000).optional(), tags: z.array(z.string().trim().min(1).max(40)).max(30).optional() }).refine((value) => value.leadStatus || value.note || value.tags).parse(req.body)
  const contact = await BusinessContact.findById(req.params.id)
  if (!contact) return res.status(404).json({ error: 'Contact not found' })
  if (input.leadStatus) contact.leadStatus = input.leadStatus
  if (input.tags) contact.tags = input.tags
  if (input.note) contact.activities.push({ body: input.note, author: req.user.id })
  await contact.save()
  res.json(contact)
})
router.get('/admin/business/contacts.csv', authenticate, requireAdmin, async (_req, res) => {
  const rows = await BusinessContact.find().sort({ createdAt: -1 }).limit(5000).lean()
  const cell = (value) => { const safe = String(value ?? '').replace(/[\r\n]/g, ' '); return `"${(/^[=+\-@\t]/.test(safe) ? `'${safe}` : safe).replaceAll('"', '""')}"` }
  res.type('text/csv').attachment('briane-dev-contacts.csv').send(['Name,Email,Company,Source,Lead Status,Marketing Consent,Created', ...rows.map((row) => [row.name, row.email, row.company, row.source, row.leadStatus, row.marketingConsent, row.createdAt?.toISOString()].map(cell).join(','))].join('\n'))
})
router.get('/admin/business/campaigns', authenticate, requireAdmin, async (_req, res) => res.json(await EmailCampaign.find().sort({ updatedAt: -1 }).lean()))
router.post('/admin/business/campaigns', authenticate, requireAdmin, async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(160), subject: z.string().trim().max(200).default(''), previewText: z.string().trim().max(250).default(''), html: z.string().max(100000).default(''), text: z.string().max(50000).default('') }).parse(req.body)
  const campaign = await EmailCampaign.create({ ...input, createdBy: req.user.id })
  res.status(201).json(campaign)
})
router.put('/admin/business/campaigns/:id', authenticate, requireAdmin, async (req, res) => {
  const campaign = await EmailCampaign.findOne({ _id: req.params.id, status: 'Draft' })
  if (!campaign) return res.status(404).json({ error: 'Draft campaign not found' })
  const input = z.object({ name: z.string().trim().min(1).max(160), subject: z.string().trim().max(200), previewText: z.string().trim().max(250), html: z.string().max(100000), text: z.string().max(50000) }).parse(req.body)
  Object.assign(campaign, input); await campaign.save(); res.json(campaign)
})
router.post('/admin/business/campaigns/:id/schedule', authenticate, requireAdmin, async (_req, res) => res.status(503).json({ error: 'Campaign scheduling is unavailable until a persistent scheduler and verified mail transport are configured.' }))

router.get('/admin/pricing', authenticate, requireAdmin, async (_req, res) => res.json(await Pricing.find().sort({ region: 1 })))

const certificateTemplateDefaults = {
  brandName: '', heading: 'CERTIFICATE OF COMPLETION',
  introduction: 'This certificate is awarded to', courseLead: 'in recognition of successfully completing the course',
  recognitionText: 'and completing the prescribed learning curriculum in AI-assisted software development and developer productivity.',
  signatoryName: 'BrianE-Dev', signatureDataUrl: '', footer: 'Certificate of successful course completion',
}
async function getCertificateTemplate() {
  const saved = await CertificateTemplate.findOne({ key: 'global' }).lean()
  return Object.fromEntries(Object.keys(certificateTemplateDefaults).map((key) => [key, saved?.[key] ?? certificateTemplateDefaults[key]]))
}
router.get('/certificates/template', authenticate, async (_req, res) => res.json(await getCertificateTemplate()))
router.get('/admin/certificate-template', authenticate, requireAdmin, async (_req, res) => res.json(await getCertificateTemplate()))
router.put('/admin/certificate-template', authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({
    brandName: z.string().trim().max(80), heading: z.string().trim().min(1).max(100),
    introduction: z.string().trim().min(1).max(180), courseLead: z.string().trim().min(1).max(120),
    recognitionText: z.string().trim().min(1).max(240),
    signatoryName: z.string().trim().min(1).max(120), footer: z.string().trim().max(180),
    signatureDataUrl: z.string().max(2_800_000).refine((value) => !value || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value), 'Upload a JPEG signature image.'),
  }).strict()
  const input = schema.parse(req.body)
  const previousValue = await getCertificateTemplate()
  await CertificateTemplate.findOneAndUpdate({ key: 'global' }, { $set: input, $setOnInsert: { key: 'global' } }, { new: true, upsert: true, runValidators: true })
  await AuditLog.create({ admin: req.user.id, action: 'certificate-template.updated', resource: 'global', previousValue, newValue: input })
  res.json(await getCertificateTemplate())
})
router.post('/admin/certificates/sample', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({ recipientName: z.string().trim().min(1).max(120), courseId: z.string().min(1) }).strict().parse(req.body)
    const course = await findCourse(input.courseId)
    if (!course) return apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
    const certificate = { certificateId: `SAMPLE-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, recipientName: input.recipientName, courseTitle: course.title, issueDate: new Date() }
    const template = await getCertificateTemplate()
    const pdf = createCertificatePdf(certificate, 'Sample certificate — not verifiable', template)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="BrianE-Dev-Sample-Certificate.pdf"', 'Cache-Control': 'private, no-store' }).send(pdf)
  } catch (error) { next(error) }
})

async function adminTtsCourse(req, res) {
  const course = await findCourse(req.params.courseId)
  if (!course || course.slug !== COURSE_SLUG || !course.published) {
    apiFailure(res, 404, 'Course not found', 'COURSE_NOT_FOUND')
    return null
  }
  return course
}

router.get('/admin/tts/courses/:courseId/status', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    res.json(await getCourseAudioStatus(String(course._id || course.id)))
  } catch (error) { next(error) }
})

router.post('/admin/tts/courses/:courseId/generate-missing', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    const input = z.object({ mode: z.enum(['missing', 'changed', 'force']).default('missing') }).strict().parse(req.body || {})
    if (!process.env.GEMINI_API_KEY?.trim()) return apiFailure(res, 503, 'Gemini TTS is not configured.', 'TTS_NOT_CONFIGURED')
    createTtsStorage()
    const { job, alreadyRunning } = await startCourseAudioBatch(String(course._id || course.id), input.mode, req.user.id)
    res.status(alreadyRunning ? 200 : 202).json({ jobId: String(job._id), status: job.status, mode: job.mode, alreadyRunning })
  } catch (error) { next(error) }
})

router.post('/admin/tts/courses/:courseId/chapters/:chapterId/generate', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const input = z.object({ force: z.boolean().default(false) }).strict().parse(req.body || {})
    if (!process.env.GEMINI_API_KEY?.trim()) return apiFailure(res, 503, 'Gemini TTS is not configured.', 'TTS_NOT_CONFIGURED')
    createTtsStorage()
    const result = await generateChapterAudio(String(course._id || course.id), lesson, { generatedBy: req.user.id, force: input.force })
    res.status(result.status === 'generating' ? 202 : 200).json(result)
  } catch (error) { next(error) }
})

router.get('/admin/tts/courses/:courseId/chapters/:chapterId/browser-transcript', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const transcript = buildTtsTranscript(lesson)
    if (!transcript) return apiFailure(res, 422, 'This chapter has no narratable content.', 'TTS_TRANSCRIPT_EMPTY')
    res.json({ chapterId: lesson.chapterId, transcript, transcriptHash: hashTranscript(transcript), voice: 'Microsoft Susan', language: 'en-GB' })
  } catch (error) { next(error) }
})

router.post('/admin/tts/courses/:courseId/chapters/:chapterId/browser-susan', authenticate, requireAdmin, express.raw({ type: 'audio/*', limit: '50mb' }), async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const mimeType = req.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (!/^audio\/(webm|ogg|mp4|mpeg|wav)$/.test(mimeType || '') || !Buffer.isBuffer(req.body) || req.body.length < 1024) {
      return apiFailure(res, 400, 'A browser audio recording is required.', 'INVALID_BROWSER_AUDIO')
    }
    const durationSeconds = z.coerce.number().int().min(1).max(3600).parse(req.get('x-audio-duration-seconds'))
    const courseId = String(course._id || course.id)
    const identity = {
      courseId,
      chapterId: lesson.chapterId,
      lessonVersion: lesson.contentVersion,
      transcriptHash: hashTranscript(buildTtsTranscript(lesson)),
      model: 'browser-speechsynthesis',
      voice: String(req.get('x-browser-voice') || '').trim().slice(0, 120),
      language: String(req.get('x-browser-language') || '').trim().slice(0, 32),
    }
    if (!identity.voice || !/^en(?:-[a-z0-9-]{2,24})?$/i.test(identity.language)) {
      return apiFailure(res, 400, 'An English browser voice identity is required.', 'INVALID_BROWSER_VOICE')
    }
    const storage = createTtsStorage()
    const cutoff = new Date(Date.now() - 15 * 60 * 1000)
    const generationToken = crypto.randomUUID()
    const previous = await TtsAudio.findOne(identity)
    let record
    try {
      record = await TtsAudio.findOneAndUpdate({
        ...identity,
        $or: [{ status: { $ne: 'generating' } }, { lastAttemptAt: { $lt: cutoff } }, { lastAttemptAt: { $exists: false }, generationStartedAt: { $lt: cutoff } }, { lastAttemptAt: { $exists: false }, generationStartedAt: { $exists: false }, updatedAt: { $lt: cutoff } }],
      }, {
        $setOnInsert: identity,
        $set: { status: 'generating', generatedBy: req.user.id, generationToken, error: null, generationStartedAt: new Date(), lastAttemptAt: new Date() },
      }, { upsert: true, new: true, setDefaultsOnInsert: true })
    } catch (error) {
      if (error.code === 11000) return apiFailure(res, 409, 'Browser audio is already being saved for this chapter.', 'AUDIO_GENERATION_IN_PROGRESS')
      throw error
    }
    if (!record) return apiFailure(res, 409, 'Browser audio could not be claimed for this chapter.', 'AUDIO_GENERATION_IN_PROGRESS')
    const generationId = crypto.randomUUID()
    const storageKey = ['brianedev', 'tts', encodeURIComponent(courseId), lesson.chapterId, identity.transcriptHash, 'browser-speechsynthesis', identity.voice.replace(/[^a-zA-Z0-9._-]/g, '_'), identity.language, 'versions', generationId, 'audio'].join('/')
    try {
      await storage.upload(storageKey, req.body, mimeType)
      const saved = await writeOwnedTtsAudio(TtsAudio, identity, generationToken, { $set: {
        status: 'ready', storageKey, chunks: [{ order: 1, storageKey, mimeType, durationSeconds }], mimeType,
        durationSeconds, chunkCount: 1, generationCompletedAt: new Date(), generatedBy: req.user.id, generationToken: null, error: null,
      } }, { new: true })
      if (!saved) return apiFailure(res, 409, 'Browser audio attempt no longer owns this chapter.', 'AUDIO_GENERATION_SUPERSEDED')
      return res.status(201).json({ chapterId: lesson.chapterId, status: 'ready', voice: identity.voice, language: identity.language, durationSeconds, bytes: req.body.length })
    } catch (error) {
      const failureMessage = (error.message || 'Browser audio save failed').slice(0, 450)
      await writeOwnedTtsAudio(TtsAudio, identity, generationToken, { $set: previous?.status === 'ready'
        ? { status: 'ready', storageKey: previous.storageKey, chunks: previous.chunks, mimeType: previous.mimeType, durationSeconds: previous.durationSeconds, chunkCount: previous.chunkCount, generationCompletedAt: previous.generationCompletedAt, error: failureMessage }
        : { status: 'failed', error: failureMessage }, $unset: { generationToken: 1 },
      })
      throw error
    }
  } catch (error) { next(error) }
})

router.post('/admin/tts/courses/:courseId/chapters/:chapterId/upload', authenticate, requireAdmin, express.raw({ type: 'audio/*', limit: '50mb' }), async (req, res, next) => {
  try {
    const course = await adminTtsCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const mimeType = req.get('content-type')?.split(';')[0].trim().toLowerCase()
    const acceptedTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm'])
    if (!acceptedTypes.has(mimeType) || !Buffer.isBuffer(req.body) || req.body.length < 1024) {
      return apiFailure(res, 400, 'Upload an MP3, WAV, M4A, AAC, OGG, or WebM audio file.', 'INVALID_AUDIO_UPLOAD')
    }
    const transcriptHash = hashTranscript(buildTtsTranscript(lesson))
    const courseId = String(course._id || course.id)
    const identity = {
      courseId, chapterId: lesson.chapterId, lessonVersion: lesson.contentVersion, transcriptHash,
      model: 'manual-upload-v1', voice: 'Manual recording', language: 'en-GB',
    }
    const storage = createTtsStorage()
    const generationToken = crypto.randomUUID()
    const previous = await TtsAudio.findOne(identity)
    let record
    try {
      record = await TtsAudio.findOneAndUpdate({
        ...identity,
        $or: [{ status: { $ne: 'generating' } }, { lastAttemptAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } }, { lastAttemptAt: { $exists: false }, generationStartedAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } }, { lastAttemptAt: { $exists: false }, generationStartedAt: { $exists: false }, updatedAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } }],
      }, {
        $setOnInsert: identity,
        $set: { status: 'generating', generatedBy: req.user.id, generationToken, error: null, generationStartedAt: new Date(), lastAttemptAt: new Date() },
      }, { upsert: true, new: true, setDefaultsOnInsert: true })
    } catch (error) {
      if (error.code === 11000) return apiFailure(res, 409, 'Audio is already being saved for this chapter.', 'AUDIO_GENERATION_IN_PROGRESS')
      throw error
    }
    if (!record) return apiFailure(res, 409, 'Audio could not be claimed for this chapter.', 'AUDIO_GENERATION_IN_PROGRESS')
    const generationId = crypto.randomUUID()
    const storageKey = ['brianedev', 'tts', encodeURIComponent(courseId), lesson.chapterId, transcriptHash, 'manual-upload', 'versions', generationId, 'audio'].join('/')
    try {
      await storage.upload(storageKey, req.body, mimeType)
      const saved = await writeOwnedTtsAudio(TtsAudio, identity, generationToken, { $set: {
        status: 'ready', storageKey, chunks: [{ order: 1, storageKey, mimeType }], mimeType,
        chunkCount: 1, generationCompletedAt: new Date(), generatedBy: req.user.id, generationToken: null, error: null,
      } }, { new: true })
      if (!saved) return apiFailure(res, 409, 'Upload attempt no longer owns this chapter.', 'AUDIO_GENERATION_SUPERSEDED')
      return res.status(201).json({ chapterId: lesson.chapterId, status: 'ready', bytes: req.body.length })
    } catch (error) {
      const failureMessage = (error.message || 'Audio upload failed').slice(0, 450)
      await writeOwnedTtsAudio(TtsAudio, identity, generationToken, { $set: previous?.status === 'ready'
        ? { status: 'ready', storageKey: previous.storageKey, chunks: previous.chunks, mimeType: previous.mimeType, durationSeconds: previous.durationSeconds, chunkCount: previous.chunkCount, generationCompletedAt: previous.generationCompletedAt, error: failureMessage }
        : { status: 'failed', error: failureMessage }, $unset: { generationToken: 1 },
      })
      throw error
    }
  } catch (error) { next(error) }
})

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
router.get('/admin/learners', authenticate, requireAdmin, async (_req, res) => {
  const learners = await User.find({ role: 'user' }).select('name email profile disabledAt createdAt updatedAt').sort({ createdAt: -1 }).limit(1000).lean()
  res.json(learners.map((learner) => ({ id: String(learner._id), ...publicLearnerProfile(learner), disabled: Boolean(learner.disabledAt), createdAt: learner.createdAt })))
})
router.patch('/admin/learners/:learnerId/status', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.learnerId)) return apiFailure(res, 404, 'Learner not found', 'LEARNER_NOT_FOUND')
  const { disabled } = z.object({ disabled: z.boolean() }).strict().parse(req.body)
  const learner = await User.findOne({ _id: req.params.learnerId, role: 'user' })
  if (!learner) return apiFailure(res, 404, 'Learner not found', 'LEARNER_NOT_FOUND')
  const previousValue = { disabled: Boolean(learner.disabledAt) }
  learner.disabledAt = disabled ? (learner.disabledAt || new Date()) : null
  await learner.save()
  await AuditLog.create({ admin: req.user.id, action: disabled ? 'learner.disabled' : 'learner.enabled', resource: learner.id, previousValue, newValue: { disabled } })
  res.json({ id: learner.id, disabled: Boolean(learner.disabledAt) })
})
router.get('/admin/transactions', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find({ application: 'brianedev', environment: getPaystackConfig().appEnvironment }).sort({ createdAt: -1 }).limit(500).populate('user', 'name email').populate('course', 'title')))
router.get('/admin/purchases', authenticate, requireAdmin, async (_req, res) => res.json(await Payment.find({ application: 'brianedev', environment: getPaystackConfig().appEnvironment }).sort({ createdAt: -1 }).populate('user', 'name email').populate('course', 'title').lean()))
router.get('/admin/certificates', authenticate, requireAdmin, async (_req, res) => res.json(await Certificate.find().sort({ issueDate: -1 }).populate('user', 'name email').populate('course', 'title')))

export default router
