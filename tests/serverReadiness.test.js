import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import mongoose from 'mongoose'

process.env.JWT_SECRET = 'readiness-test-secret-with-more-than-thirty-two-characters'
process.env.APP_ENV = 'development'
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_readiness'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_readiness'
process.env.PAYSTACK_BASE_URL = 'https://api.paystack.co'

const [{ default: app }, { Course }] = await Promise.all([
  import('../backend/src/app.js'),
  import('../backend/src/models/index.js'),
])

let server
let baseUrl
const initialReadyState = mongoose.connection.readyState
const originalCourseFind = Course.find

test.before(async () => {
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve) => server?.close(resolve))
  Course.find = originalCourseFind
  mongoose.connection.readyState = initialReadyState
})

test('liveness stays healthy while readiness and database-dependent routes report unavailable', async () => {
  mongoose.connection.readyState = 0

  const live = await fetch(`${baseUrl}/api/health`)
  assert.equal(live.status, 200)
  assert.deepEqual(await live.json(), { ok: true })

  const ready = await fetch(`${baseUrl}/api/ready`)
  assert.equal(ready.status, 503)
  assert.deepEqual(await ready.json(), { ok: false, database: 'unavailable' })

  const courses = await fetch(`${baseUrl}/api/courses`)
  assert.equal(courses.status, 503)
  assert.deepEqual(await courses.json(), { error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' })

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
  assert.equal(logout.status, 200)
})

test('readiness and existing database-backed routes recover when the database is ready', async () => {
  mongoose.connection.readyState = 1
  Course.find = () => ({
    select() { return this },
    lean: async () => [],
  })

  const ready = await fetch(`${baseUrl}/api/ready`)
  assert.equal(ready.status, 200)
  assert.deepEqual(await ready.json(), { ok: true, database: 'ready' })

  const courses = await fetch(`${baseUrl}/api/courses`)
  assert.equal(courses.status, 200)
  assert.deepEqual(await courses.json(), [])
})
