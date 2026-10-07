import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'
import test from 'node:test'

process.env.JWT_SECRET = 'phase-four-test-secret-with-enough-length'
process.env.APP_ENV = 'development'
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_phase_four'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_phase_four'
process.env.PAYSTACK_WEBHOOK_SECRET = 'phase-four-webhook-secret'
process.env.PAYSTACK_BASE_URL = 'https://api.paystack.co'

const [{ default: app }, models] = await Promise.all([
  import('../backend/src/app.js'),
  import('../backend/src/models/index.js'),
])
const { curriculum } = await import('../src/data/curriculum.js')
const { getLessonByChapterId } = await import('../backend/src/services/lessonRepository.js')
const { AssessmentAttempt, Certificate, Course, Payment, Pricing, Progress, User } = models

const course = {
  id: '507f1f77bcf86cd799439011',
  title: 'AI-Powered Developer Productivity for Software Engineers',
  slug: 'ai-powered-developer-productivity',
  description: 'Course catalog description',
  certificateEligible: true,
  sections: [{ title: 'Sensitive stored section', chapters: [{ title: 'Stored title', content: 'Sensitive embedded content' }] }],
}
const userDbId = '507f1f77bcf86cd799439012'
const secondUserId = '507f1f77bcf86cd799439013'
const adminUserId = '507f1f77bcf86cd799439014'
const testPassword = 'learner-test-password'
const userRows = new Map()
const originalFetch = globalThis.fetch
let paid = false
let server
let baseUrl
const originals = {
  userFindById: User.findById,
  userFindOne: User.findOne,
  userCreate: User.create,
  courseFindById: Course.findById,
  courseFindOne: Course.findOne,
  courseFind: Course.find,
  paymentExists: Payment.exists,
  paymentCreate: Payment.create,
  paymentFindOne: Payment.findOne,
  paymentFindOneAndUpdate: Payment.findOneAndUpdate,
  paymentFind: Payment.find,
  progressFindOne: Progress.findOne,
  progressCreate: Progress.create,
  progressUpdateOne: Progress.updateOne,
  assessmentCount: AssessmentAttempt.countDocuments,
  assessmentCreate: AssessmentAttempt.create,
  assessmentExists: AssessmentAttempt.exists,
  pricingFind: Pricing.find,
  pricingFindOne: Pricing.findOne,
  certificateFind: Certificate.find,
  certificateFindOne: Certificate.findOne,
}
let progressRecords
let attemptRecords
let priceRows
let paymentRows
let paystackRequest
let paystackVerification

function query(data) {
  return { select() { return this }, lean: async () => data }
}

test.before(async () => {
  const passwordHash = await bcrypt.hash(testPassword, 4)
  userRows.set(userDbId, { id: userDbId, name: 'Test User', email: 'learner@example.test', passwordHash, role: 'user' })
  userRows.set(secondUserId, { id: secondUserId, name: 'Second Learner', email: 'second@example.test', passwordHash, role: 'user' })
  userRows.set(adminUserId, { id: adminUserId, name: 'Admin User', email: 'admin@example.test', passwordHash, role: 'super_admin' })
  User.findById = async (id) => userRows.get(String(id)) || null
  User.findOne = (filter) => ({ select: async () => [...userRows.values()].find((user) => user.email === filter.email) || null })
  User.create = async (input) => {
    const user = { ...input, id: '507f1f77bcf86cd799439015', role: input.role || 'user' }
    userRows.set(user.id, user)
    return user
  }
  Course.findById = async (id) => id === course.id ? course : null
  Course.findOne = () => query(course)
  Course.find = () => query([course])
  Payment.exists = async () => paid ? { _id: 'paid-record' } : null
  paymentRows = new Map()
  Payment.create = async (input) => {
    const row = { ...input, status: 'pending', id: `payment-${paymentRows.size + 1}`, toObject() { return { ...this } }, save: async function save() { paymentRows.set(this.reference, this); return this } }
    paymentRows.set(row.reference, row)
    return row
  }
  Payment.findOne = async (filter) => paymentRows.get(filter.reference) || null
  Payment.findOneAndUpdate = async (filter, update) => {
    const row = [...paymentRows.values()].find((payment) => payment.id === filter._id)
    if (!row || ['paid', 'successful'].includes(row.status)) return null
    Object.assign(row, update.$set)
    return row
  }
  Payment.find = () => ({ populate: async () => [] })
  progressRecords = new Map()
  Progress.findOne = async (filter = {}) => progressRecords.get(`${filter.user}:${filter.course}`) || null
  Progress.create = async (input) => {
    const key = `${input.user}:${input.course}`
    const record = { ...input, save: async function save() { progressRecords.set(key, this); return this } }
    progressRecords.set(key, record)
    return record
  }
  Progress.updateOne = async (filter, update) => {
    const record = progressRecords.get(`${filter.user}:${filter.course}`)
    if (!record) return { matchedCount: 0 }
    const chapterCondition = filter['chapterProgress.chapterId']
    const chapterId = chapterCondition?.$ne || chapterCondition
    const exists = (record.chapterProgress || []).some((item) => item.chapterId === chapterId)
    if (chapterCondition?.$ne && exists) return { matchedCount: 0 }
    if (update.$push?.chapterProgress) {
      record.chapterProgress ||= []
      record.chapterProgress.push({ ...update.$push.chapterProgress })
    }
    if (update.$set?.currentChapterId) record.currentChapterId = update.$set.currentChapterId
    return { matchedCount: 1 }
  }
  attemptRecords = []
  AssessmentAttempt.countDocuments = async (filter) => attemptRecords.filter((item) => item.user === filter.user && item.course === filter.course && item.chapterId === filter.chapterId && item.assessmentId === filter.assessmentId).length
  AssessmentAttempt.create = async (input) => {
    const duplicate = attemptRecords.some((item) => item.user === input.user && item.course === input.course && item.chapterId === input.chapterId && item.assessmentId === input.assessmentId && item.attemptNumber === input.attemptNumber)
    if (duplicate) throw Object.assign(new Error('Duplicate attempt number'), { code: 11000 })
    const record = { ...input, _id: `attempt-${attemptRecords.length + 1}` }
    attemptRecords.push(record)
    return record
  }
  AssessmentAttempt.exists = async (filter) => attemptRecords.some((item) => item.user === filter.user && item.course === filter.course && item.chapterId === filter.chapterId && item.assessmentId === filter.assessmentId && item.passed === filter.passed)
  Pricing.find = () => ({ sort: async () => [] })
  priceRows = {
    NG: { _id: 'ng-price', region: 'NG', currency: 'NGN', originalPrice: 15000, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true, toObject() { return { ...this } } },
    INTL: { _id: 'intl-price', region: 'INTL', currency: 'USD', originalPrice: 15, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true, toObject() { return { ...this } } },
  }
  Pricing.findOne = async ({ region }) => priceRows[region] || null
  paystackRequest = null
  paystackVerification = null
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://api.paystack.co/transaction/initialize')) {
      paystackRequest = JSON.parse(options.body)
      return Response.json({ status: true, data: { authorization_url: 'https://checkout.paystack.com/test' } })
    }
    if (String(url).includes('https://api.paystack.co/transaction/verify/')) return Response.json({ status: true, data: paystackVerification })
    return originalFetch(url, options)
  }
  Certificate.find = async () => []
  Certificate.findOne = () => ({ select: async () => null })
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})
test.after(async () => {
  await new Promise((resolve) => server?.close(resolve))
  User.findById = originals.userFindById
  User.findOne = originals.userFindOne
  User.create = originals.userCreate
  Course.findById = originals.courseFindById
  Course.findOne = originals.courseFindOne
  Course.find = originals.courseFind
  Payment.exists = originals.paymentExists
  Payment.create = originals.paymentCreate
  Payment.findOne = originals.paymentFindOne
  Payment.findOneAndUpdate = originals.paymentFindOneAndUpdate
  Payment.find = originals.paymentFind
  Progress.findOne = originals.progressFindOne
  Progress.create = originals.progressCreate
  Progress.updateOne = originals.progressUpdateOne
  AssessmentAttempt.countDocuments = originals.assessmentCount
  AssessmentAttempt.create = originals.assessmentCreate
  AssessmentAttempt.exists = originals.assessmentExists
  Pricing.find = originals.pricingFind
  Pricing.findOne = originals.pricingFindOne
  globalThis.fetch = originalFetch
  Certificate.find = originals.certificateFind
  Certificate.findOne = originals.certificateFindOne
})

function sessionCookie(userId = userDbId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET)
  return `session=${token}`
}

function apiJson(path, { userId = userDbId, method = 'GET', body, headers = {} } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { ...(userId ? { cookie: sessionCookie(userId) } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

test('default NG pricing and Paystack checkout use the same configured NGN amount; INTL remains USD', async () => {
  paid = false
  userRows.get(userDbId).country = 'US'
  const defaultPricingResponse = await apiJson('/pricing')
  const defaultPricing = await defaultPricingResponse.json()
  assert.equal(defaultPricingResponse.status, 200)
  assert.equal(defaultPricingResponse.headers.get('cache-control'), 'no-store')
  assert.equal(defaultPricing.region, 'NG')
  assert.equal(defaultPricing.currency, 'NGN')
  assert.equal(defaultPricing.currentPrice, 9000)
  assert.match(new Intl.NumberFormat('en-NG', { style: 'currency', currency: defaultPricing.currency, maximumFractionDigits: 2 }).format(defaultPricing.currentPrice), /^₦/)

  priceRows.NG.originalPrice = 23750
  priceRows.NG.discountValue = 20
  const changedPricing = await (await apiJson('/pricing')).json()
  assert.equal(changedPricing.originalPrice, 23750)
  assert.equal(changedPricing.currentPrice, 19000)
  assert.equal(changedPricing.discount, 4750)
  assert.equal(changedPricing.discountValue, 20)
  assert.equal(changedPricing.currency, 'NGN')

  const initializedResponse = await apiJson('/brianedev/payments/initialize', {
    method: 'POST', body: { productId: 'ai-powered-developer-productivity' }, headers: { 'x-vercel-ip-country': 'NG' },
  })
  assert.equal(initializedResponse.status, 200)
  const { reference, authorizationUrl } = await initializedResponse.json()
  assert.equal(authorizationUrl, 'https://checkout.paystack.com/test')
  assert.equal(paystackRequest.amount, changedPricing.currentPrice * 100)
  assert.equal(paystackRequest.currency, changedPricing.currency)
  const payment = paymentRows.get(reference)
  assert.equal(payment.amount, changedPricing.currentPrice)
  assert.equal(payment.currency, changedPricing.currency)
  assert.equal(payment.region, 'NG')

  paystackVerification = { status: 'success', reference, amount: 1900000, currency: 'NGN', id: 42 }
  const verifiedResponse = await apiJson('/brianedev/payments/verify', { method: 'POST', body: { reference } })
  assert.equal(verifiedResponse.status, 200)
  assert.equal(payment.status, 'paid')
  assert.equal(payment.transactionId, '42')

  const secondInitialized = await (await apiJson('/brianedev/payments/initialize', {
    method: 'POST', body: { productId: 'ai-powered-developer-productivity' },
  })).json()
  assert.equal(paymentRows.get(secondInitialized.reference).region, 'NG')
  paystackVerification = { status: 'success', reference: secondInitialized.reference, amount: 1899900, currency: 'NGN', id: 43 }
  const rejectedVerification = await apiJson('/brianedev/payments/verify', { method: 'POST', body: { reference: secondInitialized.reference } })
  assert.equal(rejectedVerification.status, 409)
  assert.equal(paymentRows.get(secondInitialized.reference).status, 'failed')

  priceRows.NG.discountValue = 0
  const noDiscount = await (await apiJson('/pricing')).json()
  assert.equal(noDiscount.currentPrice, 23750)
  const intl = await (await apiJson('/pricing', { userId: null, headers: { 'x-vercel-ip-country': 'US' } })).json()
  assert.equal(intl.region, 'INTL')
  assert.equal(intl.currency, 'USD')
  assert.equal(intl.currentPrice, 9)
})

test('paid lesson API returns purchase-required for unauthenticated and unpaid visitors', async () => {
  paid = false
  const unauthenticated = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer`)
  assert.equal(unauthenticated.status, 403)
  assert.equal((await unauthenticated.json()).code, 'COURSE_PURCHASE_REQUIRED')

  const denied = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer`, { headers: { cookie: sessionCookie() } })
  assert.equal(denied.status, 403)
  assert.equal((await denied.json()).code, 'COURSE_PURCHASE_REQUIRED')

  paid = true
  const allowed = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer`, { headers: { cookie: sessionCookie() } })
  assert.equal(allowed.status, 200)
  const body = await allowed.json()
  assert.equal(body.lesson.chapterId, 'chapter-ai-assisted-developer')
  assert.equal(body.lesson.title, 'The AI-Assisted Developer')
  assert.equal(JSON.stringify(body).includes('correctOptionId'), false)
  assert.equal(JSON.stringify(body).includes('developer remains responsible'), false)
  assert.equal(JSON.stringify(body).includes('option-review-and-verify'), true)
})

test('public and authenticated unpaid visitors receive only the Chapter 1 preview', async () => {
  paid = false
  progressRecords.clear()
  for (const userId of [null, userDbId]) {
    const response = await apiJson('/courses/ai-powered-developer-productivity/lessons/chapter-ai-assisted-developer/preview', { userId })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.access.level, 'preview')
    assert.equal(body.access.isPreview, true)
    assert.equal(body.access.isPurchased, false)
    assert.equal(body.progress, null)
    assert.deepEqual(body.lesson.blocks.map(({ id }) => id), [
      'block-ai-collaboration-heading',
      'block-ai-collaboration-intro',
      'block-review-principle',
      'block-repeatable-loop-heading',
      'block-repeatable-loop-steps',
      'block-bounded-task-tip',
    ])
    assert.deepEqual(body.lesson.assessments, [])
    assert.deepEqual(body.lesson.exercises, [])
    assert.ok(body.lesson.ttsText)
    assert.ok(body.lesson.ttsText.includes('AI as a collaborator in engineering work'))
    assert.ok(body.lesson.ttsText.includes('Keep the task bounded'))
    assert.equal(body.lesson.ttsText.includes('Give useful context and constraints'), false)
    assert.equal(body.lesson.ttsText.includes('Goal: Explain why parseUser'), false)
    assert.equal(JSON.stringify(body).includes('correctOptionId'), false)
    assert.equal(JSON.stringify(body).includes('assessment-ai-assisted-developer-review-loop'), false)
    assert.equal(JSON.stringify(body).includes('assessment-explanation'), false)
  }
  paid = true
  const purchasedPreview = await apiJson('/courses/ai-powered-developer-productivity/lessons/chapter-ai-assisted-developer/preview')
  const purchasedPreviewBody = await purchasedPreview.json()
  assert.equal(purchasedPreviewBody.access.level, 'preview')
  assert.equal(purchasedPreviewBody.access.isPreview, true)
  assert.equal(purchasedPreviewBody.access.isPurchased, true)
  assert.deepEqual(purchasedPreviewBody.lesson.assessments, [])
  paid = false
  assert.equal(progressRecords.size, 0)
})

test('unpaid direct access to the remainder of Chapter 1 and Chapters 2 and 43 is denied without lesson data', async () => {
  paid = false
  for (const userId of [null, userDbId]) {
    for (const chapterId of ['chapter-ai-assisted-developer', 'chapter-choosing-the-right-ai-tool', 'chapter-the-ai-powered-developer-putting-everything-together']) {
      const response = await apiJson(`/courses/${course.id}/lessons/${chapterId}`, { userId })
      assert.equal(response.status, 403)
      const body = await response.json()
      assert.equal(body.code, 'COURSE_PURCHASE_REQUIRED')
      assert.equal(JSON.stringify(body).includes('AI as a collaborator in engineering work'), false)
      assert.equal(JSON.stringify(body).includes('correctOptionId'), false)
    }
    for (const chapterId of ['chapter-choosing-the-right-ai-tool', 'chapter-the-ai-powered-developer-putting-everything-together']) {
      const response = await apiJson(`/courses/${course.slug}/lessons/${chapterId}/preview`, { userId })
      assert.equal(response.status, 403)
      assert.equal((await response.json()).code, 'COURSE_PURCHASE_REQUIRED')
    }
  }
})

test('purchased learners access full lessons for later chapter IDs and ebook', async () => {
  paid = true
  progressRecords.clear()
  attemptRecords = []
  const chapterOne = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer`)
  assert.equal(chapterOne.status, 200)
  const full = await chapterOne.json()
  assert.equal(full.access.level, 'full')
  assert.equal(full.access.isPurchased, true)
  assert.ok(full.lesson.blocks.length > 6)
  assert.ok(full.lesson.assessments.length > 0)

  for (const chapterId of ['chapter-choosing-the-right-ai-tool', 'chapter-the-ai-powered-developer-putting-everything-together']) {
    const response = await apiJson(`/courses/${course.id}/lessons/${chapterId}`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.lesson.chapterId, chapterId)
    assert.equal(body.access.level, 'full')
    assert.equal(body.access.isPurchased, true)
  }

  const canonicalChapters = curriculum.sections.flatMap((section) => section.chapters)
  for (const chapter of canonicalChapters) {
    const response = await apiJson(`/courses/${course.id}/lessons/${chapter.id}`)
    assert.equal(response.status, 200, `${chapter.id} should be delivered to a purchaser`)
    const body = await response.json()
    assert.equal(body.lesson.chapterId, chapter.id)
    assert.ok(body.lesson.assessments.length > 0)
    for (const assessment of body.lesson.assessments) {
      assert.equal(Object.hasOwn(assessment, 'correctOptionId'), false)
      assert.equal(Object.hasOwn(assessment, 'explanation'), false)
    }
  }

  const assessmentChapterId = 'chapter-choosing-the-right-ai-tool'
  const lessonSource = await getLessonByChapterId(assessmentChapterId)
  const wrongAnswers = lessonSource.assessments.map((assessment) => ({
    questionId: assessment.id,
    optionId: assessment.options.find((option) => option.id !== assessment.correctOptionId).id,
  }))
  const failedAttempt = await apiJson(`/courses/${course.id}/lessons/${assessmentChapterId}/assessment`, { method: 'POST', body: { answers: wrongAnswers } })
  assert.equal(failedAttempt.status, 201)
  assert.equal((await failedAttempt.json()).assessment.passed, false)
  const beforePass = await apiJson(`/courses/${course.id}/progress`)
  const beforePassState = (await beforePass.json()).chapters.find((chapter) => chapter.chapterId === assessmentChapterId)
  assert.equal(beforePassState.status, 'in_progress')

  const optionalExercise = lessonSource.exercises.find((exercise) => !exercise.required)
  const optionalAcknowledgment = await apiJson(`/courses/${course.id}/lessons/${assessmentChapterId}/exercises/${optionalExercise.id}/complete`, { method: 'POST', body: {} })
  assert.deepEqual(await optionalAcknowledgment.json(), { exerciseId: optionalExercise.id, required: false, acknowledged: false })
  const correctAnswers = lessonSource.assessments.map((assessment) => ({ questionId: assessment.id, optionId: assessment.correctOptionId }))
  const passedAttempt = await apiJson(`/courses/${course.id}/lessons/${assessmentChapterId}/assessment`, { method: 'POST', body: { answers: correctAnswers } })
  assert.equal(passedAttempt.status, 201)
  assert.equal((await passedAttempt.json()).assessment.passed, true)
  const afterPass = await apiJson(`/courses/${course.id}/progress`)
  const afterPassState = (await afterPass.json()).chapters.find((chapter) => chapter.chapterId === assessmentChapterId)
  assert.equal(afterPassState.status, 'completed')

  const ebook = await apiJson(`/courses/${course.id}/ebook`)
  assert.equal(ebook.status, 200)
  assert.match(ebook.headers.get('content-type'), /application\/pdf/)
  assert.match(ebook.headers.get('content-disposition'), /attachment; filename="BrianE-Dev-Course-Ebook\.pdf"/)
  assert.equal(Buffer.from(await ebook.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
})

test('ebook and certificate endpoints reject visitors and authenticated unpaid learners', async () => {
  paid = false
  const ebookStatus = await apiJson(`/courses/${course.id}/ebook/status`, { userId: null })
  assert.equal(ebookStatus.status, 200)
  assert.deepEqual(await ebookStatus.json(), { available: true, title: 'BrianE-Dev Course Ebook' })
  const unauthenticatedEbook = await apiJson(`/courses/${course.id}/ebook`, { userId: null })
  assert.equal(unauthenticatedEbook.status, 403)
  assert.equal((await unauthenticatedEbook.json()).code, 'COURSE_PURCHASE_REQUIRED')
  const unpaidEbook = await apiJson(`/courses/${course.id}/ebook`)
  assert.equal(unpaidEbook.status, 403)
  assert.equal((await unpaidEbook.json()).code, 'COURSE_PURCHASE_REQUIRED')

  const unpaidCertificates = await apiJson('/me/certificates')
  assert.equal(unpaidCertificates.status, 403)
  assert.equal((await unpaidCertificates.json()).code, 'COURSE_PURCHASE_REQUIRED')
  const anonymousCertificates = await apiJson('/me/certificates', { userId: null })
  assert.equal(anonymousCertificates.status, 401)
  const publicCertificate = await apiJson('/certificates/verify/BE-test', { userId: null })
  assert.equal(publicCertificate.status, 404)

  paid = true
  const incompleteCertificates = await apiJson('/me/certificates')
  assert.equal(incompleteCertificates.status, 200)
  assert.deepEqual(await incompleteCertificates.json(), [])
  paid = false
})

test('certificate data requires a paid owner with all 43 stable chapters complete', async () => {
  paid = true
  const progressKey = `${userDbId}:${course.id}`
  const chapters = (await import('../src/data/curriculum.js')).curriculum.sections.flatMap((section) => section.chapters)
  progressRecords.set(progressKey, {
    user: userDbId,
    course: course.id,
    chapterProgress: chapters.map((chapter) => ({ chapterId: chapter.id, status: 'completed' })),
    canonicalCompletionPercentage: 100,
  })
  const certificate = {
    certificateId: 'BE-test-certificate',
    recipientName: 'Test User',
    courseTitle: course.title,
    issueDate: new Date('2026-01-01T00:00:00.000Z'),
    completionDate: new Date('2026-01-01T00:00:00.000Z'),
    verificationStatus: 'valid',
    user: userDbId,
    course: course.id,
  }
  Certificate.find = async () => [certificate]
  Certificate.findOne = (filter) => ({ select: async () => filter.certificateId === certificate.certificateId ? certificate : null })

  const completeProgress = progressRecords.get(progressKey)
  progressRecords.set(progressKey, {
    ...completeProgress,
    chapterProgress: chapters.slice(0, -1).map((chapter) => ({ chapterId: chapter.id, status: 'completed' })),
  })
  const incompleteDownload = await apiJson('/me/certificates/BE-test-certificate/download')
  assert.equal(incompleteDownload.status, 403)
  assert.equal((await incompleteDownload.json()).code, 'CERTIFICATE_NOT_ELIGIBLE')
  progressRecords.set(progressKey, completeProgress)

  const list = await apiJson('/me/certificates')
  assert.equal(list.status, 200)
  assert.equal((await list.json()).length, 1)
  const verified = await apiJson('/certificates/verify/BE-test-certificate')
  assert.equal(verified.status, 200)
  const verifiedBody = await verified.json()
  assert.equal(verifiedBody.certificateId, certificate.certificateId)
  assert.equal(verifiedBody.status, 'valid')
  assert.equal(verifiedBody.learnerName, 'Test User')
  assert.equal('email' in verifiedBody, false)
  assert.equal('user' in verifiedBody, false)
  assert.equal('course' in verifiedBody, false)

  const publicVerifier = await apiJson('/certificates/verify/BE-test-certificate', { userId: null })
  assert.equal(publicVerifier.status, 200)
  const otherOwner = await apiJson('/certificates/verify/BE-test-certificate', { userId: secondUserId })
  assert.equal(otherOwner.status, 200)

  const unauthenticatedDownload = await apiJson('/me/certificates/BE-test-certificate/download', { userId: null })
  assert.equal(unauthenticatedDownload.status, 401)
  paid = false
  const unpaidDownload = await apiJson('/me/certificates/BE-test-certificate/download')
  assert.equal(unpaidDownload.status, 403)
  assert.equal((await unpaidDownload.json()).code, 'COURSE_PURCHASE_REQUIRED')
  paid = true
  const wrongOwnerDownload = await apiJson('/me/certificates/BE-test-certificate/download', { userId: secondUserId })
  assert.equal(wrongOwnerDownload.status, 403)
  assert.equal((await wrongOwnerDownload.json()).code, 'CERTIFICATE_ACCESS_DENIED')
  const download = await apiJson('/me/certificates/BE-test-certificate/download')
  assert.equal(download.status, 200)
  assert.match(download.headers.get('content-type'), /application\/pdf/)
  assert.match(download.headers.get('content-disposition'), /BrianE-Dev-Certificate-BE-test-certificate\.pdf/)
  assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
  const invalidPublicId = await apiJson('/certificates/verify/not-a-certificate', { userId: null })
  assert.equal(invalidPublicId.status, 404)
  const invalidDownload = await apiJson('/me/certificates/not-a-certificate/download')
  assert.equal(invalidDownload.status, 404)
  progressRecords.delete(progressKey)
  paid = false
})

test('protected lesson API handles invalid chapter, complete content, and unknown course', async () => {
  paid = true
  const headers = { cookie: sessionCookie() }
  const unknownChapter = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-not-real`, { headers })
  assert.equal(unknownChapter.status, 404)
  const availableContent = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-when-not-to-use-ai`, { headers })
  assert.equal(availableContent.status, 200)
  assert.equal((await availableContent.json()).lesson.chapterId, 'chapter-when-not-to-use-ai')
  const unknownCourse = await fetch(`${baseUrl}/api/courses/not-a-course/lessons/chapter-ai-assisted-developer`, { headers })
  assert.equal(unknownCourse.status, 404)
})

test('public course endpoints expose canonical catalog metadata without stored lesson bodies', async () => {
  const single = await fetch(`${baseUrl}/api/courses/${course.slug}`)
  assert.equal(single.status, 200)
  const body = await single.json()
  assert.equal(body.curriculumVersion, '1.0.0')
  assert.equal(body.sections.length, 8)
  assert.equal(body.sections[0].chapters[0].id, 'chapter-ai-assisted-developer')
  assert.equal(JSON.stringify(body).includes('Sensitive embedded content'), false)

  const list = await fetch(`${baseUrl}/api/courses`)
  assert.equal(list.status, 200)
  assert.equal((await list.json()).length, 1)
})

test('learner login, invalid credentials, registration role isolation, and admin separation', async () => {
  const invalid = await apiJson('/auth/login', { method: 'POST', body: { email: 'learner@example.test', password: 'incorrect-password' } })
  assert.equal(invalid.status, 401)

  const login = await apiJson('/auth/login', { method: 'POST', body: { email: 'learner@example.test', password: testPassword } })
  assert.equal(login.status, 200)
  assert.match(login.headers.get('set-cookie') || '', /HttpOnly/i)
  const me = await apiJson('/auth/me', { userId: userDbId })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.role, 'user')

  const registration = await apiJson('/auth/register', {
    method: 'POST',
    body: { name: 'New Learner', email: 'new@example.test', password: 'new-learner-password', role: 'super_admin' },
  })
  assert.equal(registration.status, 201)
  const registered = await registration.json()
  assert.equal(registered.user.role, 'user')
  assert.equal(userRows.get(registered.user.id).role, 'user')

  paid = false
  progressRecords.clear()
  const newLearnerLogin = await apiJson('/auth/login', { method: 'POST', body: { email: 'new@example.test', password: 'new-learner-password' } })
  assert.equal(newLearnerLogin.status, 200)
  assert.equal((await apiJson('/auth/me', { userId: registered.user.id })).status, 200)
  const purchases = await apiJson('/me/purchases', { userId: registered.user.id })
  assert.deepEqual(await purchases.json(), [])

  const accountPreview = await apiJson('/courses/ai-powered-developer-productivity/lessons/chapter-ai-assisted-developer/preview', { userId: registered.user.id })
  assert.equal(accountPreview.status, 200)
  assert.equal((await accountPreview.json()).access.isPreview, true)
  for (const chapterId of ['chapter-ai-assisted-developer', 'chapter-choosing-the-right-ai-tool', 'chapter-the-ai-powered-developer-putting-everything-together']) {
    const fullLesson = await apiJson(`/courses/${course.id}/lessons/${chapterId}`, { userId: registered.user.id })
    assert.equal(fullLesson.status, 403)
    assert.equal((await fullLesson.json()).code, 'COURSE_PURCHASE_REQUIRED')
  }

  const unpaidProgress = await apiJson(`/courses/${course.id}/progress`, { userId: registered.user.id })
  assert.equal(unpaidProgress.status, 403)
  assert.equal((await unpaidProgress.json()).code, 'COURSE_PURCHASE_REQUIRED')
  const unpaidLegacyProgress = await apiJson(`/me/progress/${course.id}`, { userId: registered.user.id })
  assert.equal(unpaidLegacyProgress.status, 403)
  const unpaidCompletion = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: registered.user.id, method: 'POST', body: { status: 'completed' } })
  assert.equal(unpaidCompletion.status, 403)
  const unpaidAssessment = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, { userId: registered.user.id, method: 'POST', body: { answers: [] } })
  assert.equal(unpaidAssessment.status, 403)
  const unpaidExercise = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/exercises/any-exercise/complete`, { userId: registered.user.id, method: 'POST', body: {} })
  assert.equal(unpaidExercise.status, 403)
  const unpaidAsset = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=%2Fimages%2Fexample.png`, { userId: registered.user.id })
  assert.equal(unpaidAsset.status, 403)
  const unpaidEbook = await apiJson(`/courses/${course.id}/ebook`, { userId: registered.user.id })
  assert.equal(unpaidEbook.status, 403)
  const unpaidCertificates = await apiJson('/me/certificates', { userId: registered.user.id })
  assert.equal(unpaidCertificates.status, 403)

  const learnerAdminAccess = await apiJson('/admin/pricing', { userId: userDbId })
  assert.equal(learnerAdminAccess.status, 403)
  const learnerAdminMutation = await apiJson('/admin/pricing/NG', { userId: userDbId, method: 'PUT', body: { amount: 5000 } })
  assert.equal(learnerAdminMutation.status, 403)
  const adminAccess = await apiJson('/admin/pricing', { userId: adminUserId })
  assert.equal(adminAccess.status, 200)
  paid = true
  const adminProgress = await apiJson(`/courses/${course.id}/progress`, { userId: adminUserId })
  assert.equal(adminProgress.status, 200)
  paid = false
})

test('progress API uses canonical IDs, server state, strict statuses, and preserves completion', async () => {
  progressRecords.clear()
  attemptRecords = []
  paid = true
  const unauthenticated = await fetch(`${baseUrl}/api/courses/${course.id}/progress`)
  assert.equal(unauthenticated.status, 401)
  const fresh = await apiJson(`/courses/${course.id}/progress`, { userId: userDbId })
  assert.equal(fresh.status, 200)
  const initial = await fresh.json()
  assert.equal(initial.totalChapters, 43)
  assert.equal(initial.completedChapters, 0)
  assert.equal(initial.chapters.length, 43)
  assert.equal(initial.chapters[0].status, 'not_started')

  const start = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: userDbId, method: 'POST', body: { status: 'in_progress' } })
  assert.equal(start.status, 200)
  const started = await start.json()
  assert.equal(started.status, 'in_progress')
  assert.ok(started.startedAt)
  const progressKey = `${userDbId}:${course.id}`
  assert.equal(progressRecords.get(progressKey).chapterProgress.length, 1)
  const reopened = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: userDbId, method: 'POST', body: { status: 'in_progress' } })
  assert.equal(reopened.status, 200)
  assert.equal(progressRecords.get(progressKey).chapterProgress.length, 1)

  for (const body of [
    { status: 'pending' }, { status: 'finished' }, { status: 'done' },
    { status: 'completed', completedAt: '2000-01-01', completionPercentage: 100, userId: secondUserId },
    { status: 'in_progress', startedAt: '2000-01-01' },
  ]) {
    const rejected = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: userDbId, method: 'POST', body })
    assert.equal(rejected.status, 400)
  }

  const unmet = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: userDbId, method: 'POST', body: { status: 'completed' } })
  assert.equal(unmet.status, 409)
  const stable = await apiJson(`/courses/${course.id}/lessons/1-0/progress`, { userId: userDbId, method: 'POST', body: { status: 'completed' } })
  assert.equal(stable.status, 404)
  const numeric = await apiJson(`/courses/${course.id}/progress/1-0`, { userId: userDbId, method: 'POST', body: {} })
  assert.equal(numeric.status, 404)

  const wrong = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, {
    userId: userDbId, method: 'POST', body: { answers: [{ questionId: 'assessment-ai-assisted-developer-review-loop', optionId: 'option-accept-immediately' }] },
  })
  assert.equal(wrong.status, 201)
  assert.equal((await wrong.json()).assessment.passed, false)
  const stillUnmet = await apiJson(`/courses/${course.id}/progress/chapter-ai-assisted-developer`, { userId: userDbId, method: 'POST', body: {} })
  assert.equal(stillUnmet.status, 409)

  const passed = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, {
    userId: userDbId, method: 'POST', body: { answers: [{ questionId: 'assessment-ai-assisted-developer-review-loop', optionId: 'option-review-and-verify' }] },
  })
  assert.equal(passed.status, 201)
  const passedResult = await passed.json()
  assert.equal(passedResult.assessment.passed, true)
  assert.equal(passedResult.progress.status, 'completed')

  const laterFailure = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, {
    userId: userDbId, method: 'POST', body: { answers: [{ questionId: 'assessment-ai-assisted-developer-review-loop', optionId: 'option-accept-immediately' }] },
  })
  assert.equal(laterFailure.status, 201)
  assert.equal((await laterFailure.json()).assessment.passed, false)
  assert.equal(progressRecords.get(progressKey).chapterProgress[0].status, 'completed')

  const current = await apiJson(`/courses/${course.id}/progress`, { userId: userDbId })
  const currentBody = await current.json()
  assert.equal(currentBody.completedChapters, 1)
  assert.equal(currentBody.chapters[0].status, 'completed')
  assert.equal(currentBody.completionPercentage, 2.33)
  const repeated = await apiJson(`/courses/${course.id}/progress/chapter-ai-assisted-developer`, { userId: userDbId, method: 'POST', body: {} })
  assert.equal(repeated.status, 200)
  assert.equal((await repeated.json()).status, 'completed')
})

test('progress ownership is isolated between learners', async () => {
  progressRecords.clear()
  attemptRecords = []
  paid = true
  const userAStart = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/progress`, { userId: userDbId, method: 'POST', body: { status: 'in_progress' } })
  assert.equal(userAStart.status, 200)
  const userBProgress = await apiJson(`/courses/${course.id}/progress`, { userId: secondUserId })
  const userBBody = await userBProgress.json()
  assert.equal(userBBody.chapters[0].status, 'not_started')

  const userAComplete = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, {
    userId: userDbId, method: 'POST', body: { answers: [{ questionId: 'assessment-ai-assisted-developer-review-loop', optionId: 'option-review-and-verify' }] },
  })
  assert.equal((await userAComplete.json()).progress.status, 'completed')
  const userBStillEmpty = await apiJson(`/courses/${course.id}/progress`, { userId: secondUserId })
  assert.equal((await userBStillEmpty.json()).chapters[0].status, 'not_started')

  const userBAttempt = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assessment`, {
    userId: secondUserId, method: 'POST', body: { answers: [{ questionId: 'assessment-ai-assisted-developer-review-loop', optionId: 'option-accept-immediately' }] },
  })
  assert.equal(userBAttempt.status, 201)
  assert.equal(attemptRecords.filter((item) => item.user === userDbId).length, 1)
  assert.equal(attemptRecords.filter((item) => item.user === secondUserId).length, 1)
})

test('legacy lesson access requires authentication and existing paid purchase access', async () => {
  progressRecords.clear()
  attemptRecords = []
  paid = false
  const unauthenticated = await fetch(`${baseUrl}/api/courses/${course.id}/progress/chapter-ai-assisted-developer`, { method: 'POST' })
  assert.equal(unauthenticated.status, 401)
  const unpaid = await apiJson(`/courses/${course.id}/progress/chapter-ai-assisted-developer`, { userId: userDbId, method: 'POST', body: {} })
  assert.equal(unpaid.status, 403)
})

test('lesson API navigation returns first, middle, and final canonical neighbors', async () => {
  paid = true
  const first = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer`, { userId: userDbId })
  const firstBody = await first.json()
  assert.equal(firstBody.navigation.previous, null)
  assert.equal(firstBody.navigation.next.chapterId, 'chapter-choosing-the-right-ai-tool')
  assert.equal(firstBody.chapter.chapterId, 'chapter-ai-assisted-developer')

  const middle = await apiJson(`/courses/${course.id}/lessons/chapter-handling-larger-development-tasks`, { userId: userDbId })
  assert.equal(middle.status, 200)
  const middleBody = await middle.json()
  assert.equal(middleBody.chapter.chapterId, 'chapter-handling-larger-development-tasks')
  assert.equal(middleBody.navigation.previous.chapterId, 'chapter-explaining-existing-codebases')
  assert.equal(middleBody.navigation.next.chapterId, 'chapter-chatgpt-vs-github-copilot-vs-codex')

  const final = await apiJson(`/courses/${course.id}/lessons/chapter-the-ai-powered-developer-putting-everything-together`, { userId: userDbId })
  assert.equal(final.status, 200)
  const finalBody = await final.json()
  assert.equal(finalBody.chapter.chapterId, 'chapter-the-ai-powered-developer-putting-everything-together')
  assert.equal(finalBody.navigation.previous.chapterId, 'chapter-designing-your-personal-ai-development-workflow')
  assert.equal(finalBody.navigation.next, null)
})

test('protected image endpoint enforces authentication, paid access, and referenced-image restriction', async () => {
  paid = true
  const noSession = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=content%2Fprivate.png`)
  assert.equal(noSession.status, 403)
  assert.equal((await noSession.json()).code, 'COURSE_PURCHASE_REQUIRED')
  paid = false
  const unpaid = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=content%2Fprivate.png`, { userId: userDbId })
  assert.equal(unpaid.status, 403)
  paid = true
  for (const source of ['content/private.png', 'content/../README.md', '../../backend/.env', 'C:/private.png', 'content/private.svg']) {
    const response = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=${encodeURIComponent(source)}`, { userId: userDbId })
    assert.equal(response.status, 404)
  }
})
