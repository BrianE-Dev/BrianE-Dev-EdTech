import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { CourseEbookNotFoundError, resolveCourseEbook } from '../backend/src/services/courseEbookRepository.js'

test('ebook resolver serves only the expected file inside the course content root', async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-ebook-'))
  try {
    const ebookDirectory = path.join(rootDirectory, 'content', 'ebooks')
    await mkdir(ebookDirectory, { recursive: true })
    await writeFile(path.join(ebookDirectory, 'briane-dev-course.pdf'), '%PDF-1.4 fixture')
    const result = await resolveCourseEbook({ rootDirectory })
    assert.equal(result.path, path.join(ebookDirectory, 'briane-dev-course.pdf'))
    assert.equal(result.filename, 'BrianE-Dev-Course-Ebook.pdf')
  } finally {
    await rm(rootDirectory, { recursive: true, force: true })
  }
})

test('ebook resolver reports a missing ebook without returning a path', async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-ebook-empty-'))
  try {
    await mkdir(path.join(rootDirectory, 'content'), { recursive: true })
    await assert.rejects(resolveCourseEbook({ rootDirectory }), CourseEbookNotFoundError)
  } finally {
    await rm(rootDirectory, { recursive: true, force: true })
  }
})
