import { publicLessonSchema } from '../../../src/data/schemas/lessonSchema.js'

const protectedAnswerFields = new Set(['correctoptionid', 'correctanswer', 'answer', 'answerkey', 'solution', 'solutionkey'])

export function sanitizeProtectedAnswers(value) {
  if (Array.isArray(value)) return value.map(sanitizeProtectedAnswers)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !protectedAnswerFields.has(key.toLowerCase().replaceAll(/[_-]/g, '')))
    .map(([key, nested]) => [key, sanitizeProtectedAnswers(nested)]))
}

export function toPublicLesson(repositoryLesson) {
  const sanitized = sanitizeProtectedAnswers(repositoryLesson)
  return publicLessonSchema.parse(sanitized)
}
