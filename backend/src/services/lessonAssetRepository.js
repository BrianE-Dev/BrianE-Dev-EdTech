import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLessonByChapterId } from './lessonRepository.js'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const allowedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])

export class LessonAssetNotFoundError extends Error {
  constructor() {
    super('Lesson image is not available')
    this.name = 'LessonAssetNotFoundError'
  }
}

export async function resolveLessonImage(chapterId, source, { lessonLoader = getLessonByChapterId, rootDirectory = repositoryRoot } = {}) {
  const lesson = await lessonLoader(chapterId)
  const referenced = lesson.blocks.some((block) => block.type === 'image' && block.src === source)
  if (!referenced || typeof source !== 'string' || !source.startsWith('content/')) throw new LessonAssetNotFoundError()

  const extension = path.extname(source).toLowerCase()
  if (!allowedImageExtensions.has(extension)) throw new LessonAssetNotFoundError()
  const resolvedPath = path.resolve(rootDirectory, source)
  const contentDirectory = path.join(rootDirectory, 'content')
  const relativePath = path.relative(contentDirectory, resolvedPath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new LessonAssetNotFoundError()

  try {
    const [actualPath, actualContentRoot] = await Promise.all([realpath(resolvedPath), realpath(contentDirectory)])
    const actualRelativePath = path.relative(actualContentRoot, actualPath)
    if (!actualRelativePath || actualRelativePath.startsWith('..') || path.isAbsolute(actualRelativePath)) throw new LessonAssetNotFoundError()
    const fileInfo = await stat(actualPath)
    if (!fileInfo.isFile()) throw new LessonAssetNotFoundError()
    return { path: actualPath, extension }
  } catch (error) {
    if (error instanceof LessonAssetNotFoundError) throw error
    if (error.code === 'ENOENT') throw new LessonAssetNotFoundError()
    throw error
  }
}
