import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const ebookRelativePath = path.join('content', 'ebooks', 'briane-dev-course.pdf')

export class CourseEbookNotFoundError extends Error {
  constructor() {
    super('The course ebook is not available yet.')
    this.name = 'CourseEbookNotFoundError'
  }
}

export async function resolveCourseEbook({ rootDirectory = repositoryRoot } = {}) {
  const contentRoot = path.resolve(rootDirectory, 'content')
  const ebookPath = path.resolve(rootDirectory, ebookRelativePath)

  try {
    const [realContentRoot, realEbookPath] = await Promise.all([realpath(contentRoot), realpath(ebookPath)])
    const relativePath = path.relative(realContentRoot, realEbookPath)
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new CourseEbookNotFoundError()
    const fileInfo = await stat(realEbookPath)
    if (!fileInfo.isFile()) throw new CourseEbookNotFoundError()
    return { path: realEbookPath, filename: 'BrianE-Dev-Course-Ebook.pdf' }
  } catch (error) {
    if (error instanceof CourseEbookNotFoundError) throw error
    if (error.code === 'ENOENT') throw new CourseEbookNotFoundError()
    throw error
  }
}
