import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/data/curriculum.js'
import { validateLesson } from '../src/data/validation/lessonValidation.js'
import { validLessonFixture } from './fixtures/lessonFixture.js'

test('a lesson with a valid chapter ID and its canonical title passes cross-validation', () => {
  const result = validateLesson(validLessonFixture)
  assert.equal(result.valid, true, result.issues.join('\n'))
})

test('a valid chapter ID paired with the wrong canonical title fails', () => {
  const result = validateLesson({ ...validLessonFixture, title: 'The AI-Powered Developer: Putting Everything Together' })
  assert.equal(result.valid, false)
  assert.ok(result.issues.some((issue) => issue.includes('canonical curriculum title is "The AI-Assisted Developer"')))
})

test('a valid title paired with another or unknown chapter ID fails', () => {
  const otherChapter = curriculum.sections.at(-1).chapters.at(-1)
  const wrongPair = validateLesson({ ...validLessonFixture, chapterId: otherChapter.id })
  assert.equal(wrongPair.valid, false)
  assert.ok(wrongPair.issues.some((issue) => issue.includes(`canonical curriculum title is "${otherChapter.title}"`)))

  const unknownId = validateLesson({ ...validLessonFixture, chapterId: 'chapter-not-in-curriculum' })
  assert.equal(unknownId.valid, false)
  assert.ok(unknownId.issues.some((issue) => issue.includes('does not exist in the canonical curriculum')))
})

test('lesson filenames must exactly match their stable chapter IDs', () => {
  const valid = validateLesson(validLessonFixture, { filePath: 'content/lessons/chapter-ai-assisted-developer.json' })
  assert.equal(valid.valid, true, valid.issues.join('\n'))
  const invalid = validateLesson(validLessonFixture, { filePath: 'content/lessons/chapter-1.json' })
  assert.equal(invalid.valid, false)
  assert.ok(invalid.issues.some((issue) => issue.includes('expected filename "chapter-ai-assisted-developer.json"')))
})
