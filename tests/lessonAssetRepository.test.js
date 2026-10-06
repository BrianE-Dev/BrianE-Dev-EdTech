import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LessonAssetNotFoundError, resolveLessonImage } from '../backend/src/services/lessonAssetRepository.js'

test('asset resolver permits only referenced image files inside the content root', async (context) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-assets-'))
  const contentDirectory = path.join(rootDirectory, 'content', 'images')
  await mkdir(contentDirectory, { recursive: true })
  const imagePath = path.join(contentDirectory, 'lesson.png')
  await writeFile(imagePath, Buffer.from([137, 80, 78, 71]))
  await writeFile(path.join(contentDirectory, 'unreferenced.png'), Buffer.from([137, 80, 78, 71]))
  const loader = async () => ({ blocks: [{ type: 'image', src: 'content/images/lesson.png' }] })
  context.after(() => rm(rootDirectory, { recursive: true, force: true }))

  const resolved = await resolveLessonImage('chapter-test', 'content/images/lesson.png', { lessonLoader: loader, rootDirectory })
  assert.equal(await readFile(resolved.path).then((value) => value.length), 4)
  assert.equal(resolved.extension, '.png')

  for (const source of [
    'content/images/unreferenced.png',
    'content/../README.md',
    'content/../../outside.png',
    'C:/private/secret.png',
    '/private/secret.png',
    'content/images/lesson.svg',
  ]) {
    await assert.rejects(resolveLessonImage('chapter-test', source, { lessonLoader: loader, rootDirectory }), LessonAssetNotFoundError)
  }

  const directoryLoader = async () => ({ blocks: [{ type: 'image', src: 'content/images' }] })
  await assert.rejects(resolveLessonImage('chapter-test', 'content/images', { lessonLoader: directoryLoader, rootDirectory }), LessonAssetNotFoundError)
  const directoryWithImageExtension = path.join(contentDirectory, 'folder.png')
  await mkdir(directoryWithImageExtension)
  const directoryTargetLoader = async () => ({ blocks: [{ type: 'image', src: 'content/images/folder.png' }] })
  await assert.rejects(resolveLessonImage('chapter-test', 'content/images/folder.png', { lessonLoader: directoryTargetLoader, rootDirectory }), LessonAssetNotFoundError)

  const outsideFile = path.join(rootDirectory, 'outside.png')
  await writeFile(outsideFile, Buffer.from([1]))
  const symlinkPath = path.join(contentDirectory, 'outside-link.png')
  try {
    await symlink(outsideFile, symlinkPath)
    const symlinkLoader = async () => ({ blocks: [{ type: 'image', src: 'content/images/outside-link.png' }] })
    await assert.rejects(resolveLessonImage('chapter-test', 'content/images/outside-link.png', { lessonLoader: symlinkLoader, rootDirectory }), LessonAssetNotFoundError)
  } catch (error) {
    if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) throw error
    context.diagnostic('Symlink escape case skipped because this Windows environment does not permit creating symlinks.')
  }
})

test('asset resolver rejects missing referenced files and invalid chapters', async () => {
  const loader = async () => ({ blocks: [{ type: 'image', src: 'content/missing.png' }] })
  await assert.rejects(resolveLessonImage('chapter-test', 'content/missing.png', { lessonLoader: loader, rootDirectory: os.tmpdir() }), LessonAssetNotFoundError)
  await assert.rejects(resolveLessonImage('chapter-test', 'content/missing.png', { lessonLoader: async () => { throw new Error('invalid chapter') } }), /invalid chapter/)
})
