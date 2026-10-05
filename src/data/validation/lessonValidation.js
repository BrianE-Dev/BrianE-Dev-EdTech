import { curriculum } from '../curriculum.js'
import { lessonSchema } from '../schemas/lessonSchema.js'

export function validateLesson(lesson, { curriculumData = curriculum, filePath } = {}) {
  const parsed = lessonSchema.safeParse(lesson)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const field = issue.path.length ? issue.path.join('.') : '(root)'
      return `${field}: ${issue.message}`
    })
    return { valid: false, issues, data: undefined }
  }

  const data = parsed.data
  const issues = []
  const chapter = curriculumData.sections
    .flatMap((section) => section.chapters)
    .find((item) => item.id === data.chapterId)

  if (!chapter) {
    issues.push(`chapterId "${data.chapterId}" does not exist in the canonical curriculum.`)
  } else if (chapter.title !== data.title) {
    issues.push(`chapterId "${data.chapterId}" has title "${data.title}"; the canonical curriculum title is "${chapter.title}".`)
  }

  if (filePath) {
    const filename = filePath.split(/[\\/]/).pop()
    const expectedFilename = `${data.chapterId}.json`
    if (filename !== expectedFilename) {
      issues.push(`File "${filePath}" declares chapterId "${data.chapterId}"; expected filename "${expectedFilename}".`)
    }
  }

  return { valid: issues.length === 0, issues, data }
}

export function assertValidLesson(lesson, options) {
  const result = validateLesson(lesson, options)
  if (!result.valid) {
    const fileLabel = options?.filePath ? ` ${options.filePath}` : ''
    throw new Error(`Lesson validation failed:${fileLabel}\n${result.issues.map((issue) => `- ${issue}`).join('\n')}`)
  }
  return result.data
}
