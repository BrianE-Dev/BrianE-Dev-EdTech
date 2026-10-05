import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertValidCurriculum } from '../src/data/validation/curriculumValidation.js'
import { validateLesson } from '../src/data/validation/lessonValidation.js'
import { curriculum, totalChapters, totalSections } from '../src/data/curriculum.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const lessonsDirectory = new URL('../content/lessons/', import.meta.url)
const errors = []
let lessonFiles = []

try {
  assertValidCurriculum()
} catch (error) {
  errors.push(error.message)
}

try {
  lessonFiles = (await readdir(lessonsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
} catch (error) {
  if (error.code !== 'ENOENT') errors.push(`Unable to read content/lessons: ${error.message}`)
}

const activityIds = new Map()
const lessonIds = new Set()

for (const filename of lessonFiles) {
  const filePath = `${projectRoot}content/lessons/${filename}`
  let lesson
  try {
    lesson = JSON.parse(await readFile(new URL(filename, lessonsDirectory), 'utf8'))
  } catch (error) {
    errors.push(`Lesson validation failed ${filePath}: invalid JSON (${error.message}).`)
    continue
  }

  const result = validateLesson(lesson, { filePath })
  if (!result.valid) {
    errors.push(`Lesson validation failed ${filePath}:\n${result.issues.map((issue) => `- ${issue}`).join('\n')}`)
    continue
  }

  if (lessonIds.has(result.data.chapterId)) errors.push(`Lesson validation failed ${filePath}: chapterId "${result.data.chapterId}" appears in more than one lesson file.`)
  lessonIds.add(result.data.chapterId)

  for (const activity of [...result.data.exercises, ...result.data.assessments]) {
    const previousFile = activityIds.get(activity.id)
    if (previousFile) errors.push(`Lesson validation failed ${filePath}: activity ID "${activity.id}" is also used in ${previousFile}.`)
    else activityIds.set(activity.id, filePath)
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join('\n\n')}\n`)
  process.exitCode = 1
} else {
  const missingChapterIds = curriculum.sections.flatMap((section) => section.chapters)
    .map((chapter) => chapter.id)
    .filter((chapterId) => !lessonIds.has(chapterId))
  process.stdout.write(`Curriculum valid: ${totalSections} sections, ${totalChapters} chapters (${curriculum.sections.length} section records). Lessons authored and validated: ${lessonIds.size}. Missing lessons: ${missingChapterIds.length}.\n`)
  if (missingChapterIds.length) process.stdout.write(`Missing chapter IDs: ${missingChapterIds.join(', ')}\n`)
  if (process.argv.includes('--require-complete') && missingChapterIds.length) {
    process.stderr.write('Full content readiness failed: every canonical chapter must have one valid lesson file.\n')
    process.exitCode = 1
  }
}
