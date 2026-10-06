import { lessonSchema, publicLessonSchema } from '../../../src/data/schemas/lessonSchema.js'

const protectedAnswerFields = new Set(['correctoptionid', 'correctanswer', 'answer', 'answerkey', 'solution', 'solutionkey'])

export function sanitizeProtectedAnswers(value) {
  if (Array.isArray(value)) return value.map(sanitizeProtectedAnswers)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !protectedAnswerFields.has(key.toLowerCase().replaceAll(/[_-]/g, '')))
    .map(([key, nested]) => [key, sanitizeProtectedAnswers(nested)]))
}

export function toPublicLesson(repositoryLesson) {
  const validatedSource = lessonSchema.parse(repositoryLesson)
  const fullLesson = { ...validatedSource }
  delete fullLesson.preview
  const sanitized = sanitizeProtectedAnswers(fullLesson)
  const withoutExplanations = {
    ...sanitized,
    assessments: sanitized.assessments.map(({ explanation, ...assessment }) => {
      void explanation
      return assessment
    }),
  }
  return publicLessonSchema.parse(withoutExplanations)
}

export function toPublicPreviewLesson(repositoryLesson) {
  const validatedSource = lessonSchema.parse(repositoryLesson)
  if (validatedSource.chapterId !== 'chapter-ai-assisted-developer' || !validatedSource.preview) {
    throw new Error('This lesson has no public preview boundary.')
  }

  const previewBlockIds = new Set(validatedSource.preview.blockIds)
  const lessonWithoutPreviewMetadata = { ...validatedSource }
  delete lessonWithoutPreviewMetadata.preview
  return toPublicLesson({
    ...lessonWithoutPreviewMetadata,
    objectives: [],
    blocks: validatedSource.blocks.filter((block) => previewBlockIds.has(block.id)),
    ttsText: null,
    exercises: [],
    assessments: [],
  })
}
