import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'
import test from 'node:test'

process.env.JWT_SECRET = 'phase-four-test-secret-with-enough-length'
process.env.APP_ENV = 'development'
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_phase_four'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_phase_four'
process.env.PAYSTACK_WEBHOOK_SECRET = 'phase-four-webhook-secret'
process.env.PAYSTACK_BASE_URL = 'https://api.paystack.co'

const [{ default: app }, { Course, Payment, User }] = await Promise.all([
  import('../backend/src/app.js'),
  import('../backend/src/models/index.js'),
])

const course = {
  id: 'course-db-id',
  title: 'AI-Powered Developer Productivity for Software Engineers',
  slug: 'ai-powered-developer-productivity',
  description: 'Course catalog description',
  sections: [{ title: 'Sensitive stored section', chapters: [{ title: 'Stored title', content: 'Sensitive embedded content' }] }],
}
let paid = false
let server
let baseUrl
const originals = {
  userFindById: User.findById,
  courseFindById: Course.findById,
  courseFindOne: Course.findOne,
  courseFind: Course.find,
  paymentExists: Payment.exists,
}

function query(data) {
  return { select() { return this }, lean: async () => data }
}

test.before(async () => {
  User.findById = async (id) => id === 'user-db-id' ? { id, name: 'Test User', role: 'user' } : null
  Course.findById = async (id) => id === course.id ? course : null
  Course.findOne = () => query(course)
  Course.find = () => query([course])
  Payment.exists = async () => paid ? { _id: 'paid-record' } : null
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve) => server?.close(resolve))
  User.findById = originals.userFindById
  Course.findById = originals.courseFindById
  Course.findOne = originals.courseFindOne
  Course.find = originals.courseFind
  Payment.exists = originals.paymentExists
})

function sessionCookie() {
  const token = jwt.sign({ sub: 'user-db-id' }, process.env.JWT_SECRET)
  return `session=${token}`
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
