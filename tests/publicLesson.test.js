import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeProtectedAnswers, toPublicLesson } from '../backend/src/services/publicLesson.js'
import { validLessonFixture, validAssessmentFixture } from './fixtures/lessonFixture.js'

test('public transformation recursively removes answer keys and explanations', () => {
  const rawLesson = {
    ...validLessonFixture,
    assessments: [validAssessmentFixture],
  }
  const publicLesson = toPublicLesson(rawLesson)
  const serialized = JSON.stringify({
    publicLesson,
    recursivelySanitized: sanitizeProtectedAnswers({ nested: [{ correctOptionId: 'secret', answer_key: 'secret', safe: true }] }),
  })
  for (const key of ['correctOptionId', 'answer_key', 'answerKey', 'correct_answer']) assert.equal(serialized.includes(key), false)
  assert.equal(publicLesson.assessments[0].options.length, 2)
  assert.equal('explanation' in publicLesson.assessments[0], false)
})
