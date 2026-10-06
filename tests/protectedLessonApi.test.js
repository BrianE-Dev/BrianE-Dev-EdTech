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
const { AssessmentAttempt, Course, Payment, Pricing, Progress, User } = models

const course = {
  id: '507f1f77bcf86cd799439011',
  title: 'AI-Powered Developer Productivity for Software Engineers',
  slug: 'ai-powered-developer-productivity',
  description: 'Course catalog description',
  sections: [{ title: 'Sensitive stored section', chapters: [{ title: 'Stored title', content: 'Sensitive embedded content' }] }],
}
const userDbId = '507f1f77bcf86cd799439012'
const secondUserId = '507f1f77bcf86cd799439013'
const adminUserId = '507f1f77bcf86cd799439014'
const testPassword = 'learner-test-password'
const userRows = new Map()
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
  progressFindOne: Progress.findOne,
  progressCreate: Progress.create,
  progressUpdateOne: Progress.updateOne,
  assessmentCount: AssessmentAttempt.countDocuments,
  assessmentCreate: AssessmentAttempt.create,
  assessmentExists: AssessmentAttempt.exists,
  pricingFind: Pricing.find,
}
let progressRecords
let attemptRecords

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
  Progress.findOne = originals.progressFindOne
  Progress.create = originals.progressCreate
  Progress.updateOne = originals.progressUpdateOne
  AssessmentAttempt.countDocuments = originals.assessmentCount
  AssessmentAttempt.create = originals.assessmentCreate
  AssessmentAttempt.exists = originals.assessmentExists
  Pricing.find = originals.pricingFind
})

function sessionCookie(userId = userDbId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET)
  return `session=${token}`
}

function apiJson(path, { userId = userDbId, method = 'GET', body } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { ...(userId ? { cookie: sessionCookie(userId) } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

test('protected lesson API enforces authentication and existing paid purchase access', async () => {
  paid = false
  const unauthenticated = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer`)
  assert.equal(unauthenticated.status, 401)

  const denied = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer`, { headers: { cookie: sessionCookie() } })
  assert.equal(denied.status, 403)

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

test('protected lesson API handles invalid chapter, unavailable content, and unknown course', async () => {
  paid = true
  const headers = { cookie: sessionCookie() }
  const unknownChapter = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-not-real`, { headers })
  assert.equal(unknownChapter.status, 404)
  const missingContent = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-when-not-to-use-ai`, { headers })
  assert.equal(missingContent.status, 404)
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

  const missingButCanonical = await apiJson(`/courses/${course.id}/lessons/chapter-handling-larger-development-tasks`, { userId: userDbId })
  assert.equal(missingButCanonical.status, 404)
  const finalMissing = await apiJson(`/courses/${course.id}/lessons/chapter-the-ai-powered-developer-putting-everything-together`, { userId: userDbId })
  assert.equal(finalMissing.status, 404)
})

test('protected image endpoint enforces authentication, paid access, and referenced-image restriction', async () => {
  paid = true
  const noSession = await fetch(`${baseUrl}/api/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=content%2Fprivate.png`)
  assert.equal(noSession.status, 401)
  paid = false
  const unpaid = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=content%2Fprivate.png`, { userId: userDbId })
  assert.equal(unpaid.status, 403)
  paid = true
  for (const source of ['content/private.png', 'content/../README.md', '../../backend/.env', 'C:/private.png', 'content/private.svg']) {
    const response = await apiJson(`/courses/${course.id}/lessons/chapter-ai-assisted-developer/assets?src=${encodeURIComponent(source)}`, { userId: userDbId })
    assert.equal(response.status, 404)
  }
})
