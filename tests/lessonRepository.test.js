import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getLessonByChapterId, InvalidChapterError, InvalidLessonContentError, LessonNotFoundError } from '../backend/src/services/lessonRepository.js'
import { validLessonFixture } from './fixtures/lessonFixture.js'

test('repository resolves and validates a lesson by stable chapterId', async () => {
  const lesson = await getLessonByChapterId('chapter-ai-assisted-developer')
  assert.equal(lesson.chapterId, 'chapter-ai-assisted-developer')
  assert.equal(lesson.title, 'The AI-Assisted Developer')
})

test('repository distinguishes unknown chapters and missing lesson files', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-missing-lessons-'))
  const lessonsDirectory = path.join(root, 'lessons')
  await mkdir(lessonsDirectory)
  context.after(() => rm(root, { recursive: true, force: true }))

  await assert.rejects(getLessonByChapterId('chapter-not-in-curriculum'), InvalidChapterError)
  await assert.rejects(getLessonByChapterId('chapter-when-not-to-use-ai', { lessonsDirectory }), LessonNotFoundError)
})

test('repository rejects invalid JSON and invalid lesson contracts', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-lessons-'))
  const lessonsDirectory = path.join(root, 'lessons')
  await mkdir(lessonsDirectory)
  context.after(() => rm(root, { recursive: true, force: true }))

  await writeFile(path.join(lessonsDirectory, 'chapter-ai-assisted-developer.json'), '{invalid json')
  await assert.rejects(getLessonByChapterId('chapter-ai-assisted-developer', { lessonsDirectory }), InvalidLessonContentError)

  await writeFile(path.join(lessonsDirectory, 'chapter-ai-assisted-developer.json'), JSON.stringify({ ...validLessonFixture, blocks: [{ type: 'unknown' }] }))
  await assert.rejects(getLessonByChapterId('chapter-ai-assisted-developer', { lessonsDirectory }), InvalidLessonContentError)

  await writeFile(path.join(lessonsDirectory, 'wrong-file-name.json'), JSON.stringify(validLessonFixture))
  await assert.rejects(getLessonByChapterId('chapter-ai-assisted-developer', { lessonsDirectory }), InvalidLessonContentError)
  assert.equal((await readFile(path.join(lessonsDirectory, 'wrong-file-name.json'), 'utf8')).length > 0, true)
})
