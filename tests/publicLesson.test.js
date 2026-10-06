import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeProtectedAnswers, toPublicLesson, toPublicPreviewLesson } from '../backend/src/services/publicLesson.js'
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

test('preview transformation returns only stable allowlisted Chapter 1 blocks and no paid activities', () => {
  const rawLesson = {
    ...validLessonFixture,
    blocks: [
      { id: 'block-public-intro', type: 'paragraph', text: 'Public preview text.' },
      { id: 'block-paid-detail', type: 'paragraph', text: 'Locked paid text.' },
    ],
    preview: { blockIds: ['block-public-intro'] },
    ttsText: 'Paid narration text.',
    exercises: [],
    assessments: [validAssessmentFixture],
  }
  const preview = toPublicPreviewLesson(rawLesson)
  assert.deepEqual(preview.blocks.map((block) => block.text), ['Public preview text.'])
  assert.deepEqual(preview.assessments, [])
  assert.deepEqual(preview.exercises, [])
  assert.equal(preview.ttsText, null)
  assert.equal(JSON.stringify(preview).includes('Locked paid text.'), false)
  assert.equal(JSON.stringify(preview).includes('correctOptionId'), false)
  assert.equal('preview' in preview, false)
})

test('preview transformation rejects unsupported chapters and missing preview metadata', () => {
  const otherChapter = { ...validLessonFixture, chapterId: 'chapter-choosing-the-right-ai-tool', blocks: [{ id: 'block-any', type: 'paragraph', text: 'Preview-like content.' }], preview: { blockIds: ['block-any'] } }
  assert.throws(() => toPublicPreviewLesson(otherChapter), /only supported for Chapter 1/i)
  assert.throws(() => toPublicPreviewLesson(validLessonFixture), /no public preview boundary/i)
})
