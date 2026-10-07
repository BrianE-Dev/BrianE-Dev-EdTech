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
  const previewBlocks = validatedSource.blocks.filter((block) => previewBlockIds.has(block.id))
  const previewTtsText = previewBlocks.map((block) => {
    switch (block.type) {
      case 'heading':
      case 'paragraph': return block.text
      case 'list':
      case 'ordered-list': return block.items.join('. ')
      case 'code': return block.code
      case 'callout': return `${block.title}. ${block.text}`
      case 'quote': return [block.text, block.attribution].filter(Boolean).join('. ')
      case 'table': return [block.headers, ...block.rows].flat().join('. ')
      case 'image': return [block.alt, block.caption].filter(Boolean).join('. ')
      default: return ''
    }
  }).filter(Boolean).join('\n')
  const lessonWithoutPreviewMetadata = { ...validatedSource }
  delete lessonWithoutPreviewMetadata.preview
  return toPublicLesson({
    ...lessonWithoutPreviewMetadata,
    objectives: [],
    blocks: previewBlocks,
    ttsText: previewTtsText || null,
    exercises: [],
    assessments: [],
  })
}
