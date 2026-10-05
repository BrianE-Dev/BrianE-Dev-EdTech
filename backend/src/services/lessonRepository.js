import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { curriculum } from '../../../src/data/curriculum.js'
import { assertValidCurriculum } from '../../../src/data/validation/curriculumValidation.js'
import { validateLesson } from '../../../src/data/validation/lessonValidation.js'

const defaultLessonsDirectory = fileURLToPath(new URL('../../../content/lessons/', import.meta.url))

export class InvalidChapterError extends Error {
  constructor(chapterId) {
    super(`Unknown chapter: ${chapterId}`)
    this.name = 'InvalidChapterError'
  }
}

export class LessonNotFoundError extends Error {
  constructor(chapterId) {
    super(`Lesson content is not available for ${chapterId}`)
    this.name = 'LessonNotFoundError'
  }
}

export class InvalidLessonContentError extends Error {
  constructor(chapterId, message, options) {
    super(`Lesson content failed validation for ${chapterId}: ${message}`, options)
    this.name = 'InvalidLessonContentError'
  }
}

export class LessonRepositoryError extends Error {
  constructor(chapterId, options) {
    super(`Unable to load lesson content for ${chapterId}`, options)
    this.name = 'LessonRepositoryError'
  }
}

export async function getLessonByChapterId(chapterId, { lessonsDirectory = defaultLessonsDirectory } = {}) {
  assertValidCurriculum()
  const chapter = curriculum.sections.flatMap((section) => section.chapters).find((item) => item.id === chapterId)
  if (!chapter) throw new InvalidChapterError(chapterId)

  const filePath = `${lessonsDirectory}/${chapterId}.json`
  let content
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') throw new LessonNotFoundError(chapterId, { cause: error })
    throw new LessonRepositoryError(chapterId, { cause: error })
  }

  let lesson
  try {
    lesson = JSON.parse(content)
  } catch (error) {
    throw new InvalidLessonContentError(chapterId, 'invalid JSON', { cause: error })
  }

  const validation = validateLesson(lesson, { filePath })
  if (!validation.valid) {
    throw new InvalidLessonContentError(chapterId, validation.issues.join(' '))
  }
  return validation.data
}
