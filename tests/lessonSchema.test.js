import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessmentSchema,
  exerciseSchema,
  lessonBlockSchema,
  lessonSchema,
  publicLessonSchema,
  publicAssessmentSchema,
} from '../src/data/schemas/lessonSchema.js'
import { validAssessmentFixture, validLessonFixture } from './fixtures/lessonFixture.js'

test('valid lesson and activity structures pass schema validation', () => {
  assert.equal(lessonSchema.safeParse(validLessonFixture).success, true)
  assert.equal(assessmentSchema.safeParse(validAssessmentFixture).success, true)
  assert.equal(exerciseSchema.safeParse({
    id: 'exercise-chapter-ai-assisted-developer-01',
    type: 'practical',
    title: 'Fixture exercise',
    objective: 'Verify the exercise contract.',
    instructions: ['Complete the structural check.'],
    constraints: [],
    expectedOutcome: 'A schema-valid exercise object.',
    required: false,
  }).success, true)
})

test('required lesson version, chapter identity, and title fields are enforced', () => {
  for (const field of ['schemaVersion', 'contentVersion', 'chapterId', 'title']) {
    const invalid = { ...validLessonFixture }
    delete invalid[field]
    assert.equal(lessonSchema.safeParse(invalid).success, false, `${field} should be required`)
  }
  assert.equal(lessonSchema.safeParse({ ...validLessonFixture, schemaVersion: '2.0.0' }).success, false)
  assert.equal(lessonSchema.safeParse({ ...validLessonFixture, contentVersion: '1.0' }).success, false)
})

test('unsupported block types and malformed code blocks are rejected', () => {
  assert.equal(lessonBlockSchema.safeParse({ type: 'html', html: '<script>alert(1)</script>' }).success, false)
  assert.equal(lessonBlockSchema.safeParse({ type: 'code', code: 'const value = 1' }).success, false)
  assert.equal(lessonBlockSchema.safeParse({ type: 'heading', level: 1, text: 'Invalid level' }).success, false)
  assert.equal(lessonBlockSchema.safeParse({ type: 'image', src: 'content/diagram.png', alt: '   ' }).success, false)
})

test('tables require each row to match the header column count', () => {
  const malformed = { type: 'table', headers: ['Tool', 'Use'], rows: [['ChatGPT']] }
  const result = lessonBlockSchema.safeParse(malformed)
  assert.equal(result.success, false)
  assert.ok(result.error.issues.some((issue) => issue.message.includes('expected 2')))
})

test('invalid exercise and assessment structures are rejected', () => {
  const missingExerciseField = {
    id: 'exercise-chapter-ai-assisted-developer-01',
    type: 'unknown',
    title: 'Fixture',
    objective: 'Fixture objective',
    instructions: [],
    constraints: [],
    expectedOutcome: 'Fixture outcome',
    required: false,
  }
  assert.equal(exerciseSchema.safeParse(missingExerciseField).success, false)
  assert.equal(assessmentSchema.safeParse({ ...validAssessmentFixture, correctOptionId: 'option-missing' }).success, false)
  assert.equal(assessmentSchema.safeParse({ ...validAssessmentFixture, passThreshold: 1.1 }).success, false)
  assert.equal(assessmentSchema.safeParse({ ...validAssessmentFixture, options: [validAssessmentFixture.options[0]] }).success, false)
})

test('lesson rejects duplicate exercise and assessment IDs', () => {
  const exercise = {
    id: 'exercise-chapter-ai-assisted-developer-01', type: 'reflection', title: 'Fixture',
    objective: 'Fixture objective', instructions: [], constraints: [], expectedOutcome: 'Fixture outcome', required: false,
  }
  const assessment = { ...validAssessmentFixture }
  const result = lessonSchema.safeParse({
    ...validLessonFixture,
    exercises: [exercise, { ...exercise }],
    assessments: [assessment, { ...assessment }],
  })
  assert.equal(result.success, false)
  assert.ok(result.error.issues.some((issue) => issue.message.includes('Exercise IDs must be unique')))
  assert.ok(result.error.issues.some((issue) => issue.message.includes('Assessment IDs must be unique')))
})

test('frontend assessment schema rejects server-only answer keys', () => {
  assert.equal(publicAssessmentSchema.safeParse(validAssessmentFixture).success, false)
  const publicAssessment = { ...validAssessmentFixture }
  delete publicAssessment.correctOptionId
  delete publicAssessment.explanation
  assert.equal(publicAssessmentSchema.safeParse(publicAssessment).success, true)

  const publicLesson = { ...validLessonFixture, assessments: [publicAssessment] }
  assert.equal(publicLessonSchema.safeParse(publicLesson).success, true)
  assert.equal(publicLessonSchema.safeParse({ ...validLessonFixture, assessments: [validAssessmentFixture] }).success, false)
})
