import { z } from 'zod'

export const LESSON_SCHEMA_VERSION = '1.0.0'

const nonEmptyText = z.string().min(1).refine((value) => value.trim().length > 0, 'Must not be blank')
const stableBlockId = z.string().regex(/^block-[a-z0-9]+(?:-[a-z0-9]+)*$/)
const blockIdentity = { id: stableBlockId.optional() }
const previewSchema = z.object({ blockIds: z.array(stableBlockId).min(1) }).strict()

const headingBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('heading'),
  level: z.number().int().min(2).max(4),
  text: nonEmptyText,
}).strict()

const paragraphBlockSchema = z.object({ ...blockIdentity, type: z.literal('paragraph'), text: nonEmptyText }).strict()
const listBlockSchema = z.object({ ...blockIdentity, type: z.literal('list'), items: z.array(nonEmptyText) }).strict()
const orderedListBlockSchema = z.object({ ...blockIdentity, type: z.literal('ordered-list'), items: z.array(nonEmptyText) }).strict()

const codeBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('code'),
  language: nonEmptyText,
  filename: nonEmptyText.optional(),
  code: z.string().min(1),
  caption: nonEmptyText.optional(),
}).strict()

const calloutBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('callout'),
  variant: z.enum(['info', 'tip', 'warning', 'note']),
  title: nonEmptyText,
  text: nonEmptyText,
}).strict()

const quoteBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('quote'),
  text: nonEmptyText,
  attribution: nonEmptyText.optional(),
}).strict()

const tableBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('table'),
  headers: z.array(nonEmptyText).min(1),
  rows: z.array(z.array(z.string())),
}).strict().superRefine((table, context) => {
  table.rows.forEach((row, rowIndex) => {
    if (row.length !== table.headers.length) {
      context.addIssue({
        code: 'custom',
        path: ['rows', rowIndex],
        message: `Row has ${row.length} columns; expected ${table.headers.length} to match the headers.`,
      })
    }
  })
})

const imageBlockSchema = z.object({
  ...blockIdentity,
  type: z.literal('image'),
  src: nonEmptyText.refine((value) => value.startsWith('content/') && !value.split('/').includes('..'), 'Must be a safe relative path under content/'),
  alt: nonEmptyText,
  caption: nonEmptyText.optional(),
}).strict()

const dividerBlockSchema = z.object({ ...blockIdentity, type: z.literal('divider') }).strict()

export const lessonBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  paragraphBlockSchema,
  listBlockSchema,
  orderedListBlockSchema,
  codeBlockSchema,
  calloutBlockSchema,
  quoteBlockSchema,
  tableBlockSchema,
  imageBlockSchema,
  dividerBlockSchema,
])

export const exerciseSchema = z.object({
  id: z.string().regex(/^exercise-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(['practical', 'reflection', 'implementation', 'analysis']),
  title: nonEmptyText,
  objective: nonEmptyText,
  instructions: z.array(nonEmptyText),
  constraints: z.array(nonEmptyText),
  expectedOutcome: nonEmptyText,
  required: z.boolean(),
}).strict()

const assessmentBaseSchema = z.object({
  id: z.string().regex(/^assessment-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(['multiple-choice', 'true-false', 'scenario']),
  prompt: nonEmptyText,
  options: z.array(z.object({ id: z.string().regex(/^option-[a-z0-9]+(?:-[a-z0-9]+)*$/), text: nonEmptyText }).strict()).min(2),
  explanation: nonEmptyText,
  required: z.boolean(),
  passThreshold: z.number().min(0).max(1),
  correctOptionId: z.string().regex(/^option-[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict()

export const assessmentSchema = assessmentBaseSchema.superRefine((assessment, context) => {
  const optionIds = assessment.options.map(({ id }) => id)
  if (new Set(optionIds).size !== optionIds.length) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'Option IDs must be unique.' })
  }
  if (!optionIds.includes(assessment.correctOptionId)) {
    context.addIssue({ code: 'custom', path: ['correctOptionId'], message: 'Must identify one of this assessment’s options.' })
  }
})

// Client-facing data must be parsed through this key-free schema.
export const publicAssessmentSchema = assessmentBaseSchema.omit({ correctOptionId: true }).extend({ explanation: z.never().optional() }).strict()

const lessonFields = {
  schemaVersion: z.literal(LESSON_SCHEMA_VERSION),
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must use semantic-version-style major.minor.patch.'),
  chapterId: z.string().regex(/^chapter-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: nonEmptyText,
  objectives: z.array(nonEmptyText),
  blocks: z.array(lessonBlockSchema),
  ttsText: nonEmptyText.nullable(),
  exercises: z.array(exerciseSchema),
}

function validateUniqueActivityIds(lesson, context) {
  const blockIds = lesson.blocks.flatMap((block) => block.id ? [block.id] : [])
  if (new Set(blockIds).size !== blockIds.length) {
    context.addIssue({ code: 'custom', path: ['blocks'], message: 'Block IDs must be unique within a lesson.' })
  }

  if (lesson.preview) {
    if (new Set(lesson.preview.blockIds).size !== lesson.preview.blockIds.length) {
      context.addIssue({ code: 'custom', path: ['preview', 'blockIds'], message: 'Preview block IDs must be unique.' })
    }
    const availableBlockIds = new Set(blockIds)
    lesson.preview.blockIds.forEach((blockId, index) => {
      if (!availableBlockIds.has(blockId)) {
        context.addIssue({ code: 'custom', path: ['preview', 'blockIds', index], message: `Preview block ID "${blockId}" must match a lesson block.` })
      }
    })
    if (lesson.chapterId !== 'chapter-ai-assisted-developer') {
      context.addIssue({ code: 'custom', path: ['preview'], message: 'Public preview metadata is only supported for Chapter 1.' })
    }
  }

  const exerciseIds = lesson.exercises.map(({ id }) => id)
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    context.addIssue({ code: 'custom', path: ['exercises'], message: 'Exercise IDs must be unique within a lesson.' })
  }
  const assessmentIds = lesson.assessments.map(({ id }) => id)
  if (new Set(assessmentIds).size !== assessmentIds.length) {
    context.addIssue({ code: 'custom', path: ['assessments'], message: 'Assessment IDs must be unique within a lesson.' })
  }
}

export const lessonSchema = z.object({
  ...lessonFields,
  preview: previewSchema.optional(),
  assessments: z.array(assessmentSchema),
}).strict().superRefine(validateUniqueActivityIds)

// Browser/API lesson payloads use this schema, which cannot accept answer keys.
export const publicLessonSchema = z.object({
  ...lessonFields,
  assessments: z.array(publicAssessmentSchema),
}).strict().superRefine(validateUniqueActivityIds)
