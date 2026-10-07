import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import mongoose from 'mongoose'
import { AuditLog, Certificate, Course, Payment, Pricing, Progress, User } from '../models/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
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
  const config = await Pricing.findOne({ region: 'NG' })
  if (!config) return res.status(503).json({ error: 'Pricing is not configured' })
  if (config.currency !== 'NGN') return res.status(503).json({ error: 'Nigerian pricing must be configured in NGN' })
  const { _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, promotionActive } = getFinalPrice(config)
  res.set('Cache-Control', 'no-store')
  res.json({ id: _id, region: key, currency, originalPrice, currentPrice, discount, discountType, discountValue, discountEnabled: promotionActive, promotionActive })
})

function authenticateOptional(req, _res, next) {
  const token = req.cookies?.session
  if (!token) return next()
  try { jwt.verify(token, process.env.JWT_SECRET, (error, payload) => { if (!error) User.findById(payload.sub).then((user) => { req.user = user; next() }).catch(next); else next() }) } catch { next() }
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

router.post('/payments/initialize', authenticate, initializeCoursePayment)
router.post('/brianedev/payments/initialize', authenticate, initializeCoursePayment)

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
router.post('/payments/verify', authenticate, verifyCoursePayment)
router.post('/brianedev/payments/verify', authenticate, verifyCoursePayment)

async function paystackWebhook(req, res) {
  const signature = req.get('x-paystack-signature')
  const { webhookSecret, appEnvironment } = getPaystackConfig()
  if (!Buffer.isBuffer(req.rawBody)) return res.status(400).json({ error: 'Webhook request body is invalid' })
  const expected = crypto.createHmac('sha512', webhookSecret).update(req.rawBody).digest('hex')
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

router.get('/courses/:courseId/lessons/:chapterId', authenticateOptional, async (req, res, next) => {
  try {
    const course = await getPaidCourse(req, res)
    if (!course) return
    const lesson = await loadCanonicalLesson(req.params.chapterId, res)
    if (!lesson) return
    const metadata = getChapterMetadata(lesson.chapterId)
    const progress = await openLessonProgress({ user: req.user, course, chapterId: lesson.chapterId })
    res.json({
      course: course.title,
      lesson: toPublicLesson(lesson),
      ...metadata,
      progress: progressState(progress, lesson.chapterId),
      access: { level: 'full', isPreview: false, isPurchased: true, purchaseRequired: false },
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
    const pdf = createCertificatePdf(certificate, verificationUrl)
    const safeId = certificate.certificateId.replace(/[^a-z0-9-]/gi, '')
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="BrianE-Dev-Certificate-${safeId}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(pdf)
  } catch (error) { next(error) }
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
