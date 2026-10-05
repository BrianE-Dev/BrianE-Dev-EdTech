import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessCourseLesson } from '../backend/src/services/courseLessonAccess.js'

test('lesson access denies missing user or course and checks existing paid BrianE-Dev access', async () => {
  const queries = []
  const PaymentModel = { exists: async (query) => { queries.push(query); return query.status.$in.includes('paid') } }
  const course = { id: 'course-db-id' }

  assert.equal(await canAccessCourseLesson(null, course, { PaymentModel, appEnvironment: 'development' }), false)
  assert.equal(await canAccessCourseLesson({ id: 'user-db-id' }, null, { PaymentModel, appEnvironment: 'development' }), false)
  assert.equal(await canAccessCourseLesson({ id: 'user-db-id' }, course, { PaymentModel, appEnvironment: 'development' }), true)
  assert.deepEqual(queries[0], {
    user: 'user-db-id',
    course: 'course-db-id',
    application: 'brianedev',
    environment: 'development',
    status: { $in: ['paid', 'successful'] },
  })

  const noPurchase = { exists: async () => null }
  assert.equal(await canAccessCourseLesson({ id: 'user-db-id' }, course, { PaymentModel: noPurchase, appEnvironment: 'development' }), false)
})
