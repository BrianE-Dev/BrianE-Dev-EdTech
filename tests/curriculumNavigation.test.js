import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/data/curriculum.js'
import { getChapterMetadata } from '../backend/src/services/curriculumNavigation.js'

const chapters = curriculum.sections.flatMap((section) => section.chapters)

test('chapter navigation uses stable canonical IDs at the first, middle, and final chapters', () => {
  const first = getChapterMetadata(chapters[0].id)
  assert.equal(first.navigation.previous, null)
  assert.deepEqual(first.navigation.next, { chapterId: chapters[1].id, number: chapters[1].number, title: chapters[1].title })

  const middleIndex = 20
  const middle = getChapterMetadata(chapters[middleIndex].id)
  assert.deepEqual(middle.navigation.previous, { chapterId: chapters[middleIndex - 1].id, number: chapters[middleIndex - 1].number, title: chapters[middleIndex - 1].title })
  assert.deepEqual(middle.navigation.next, { chapterId: chapters[middleIndex + 1].id, number: chapters[middleIndex + 1].number, title: chapters[middleIndex + 1].title })

  const final = getChapterMetadata(chapters.at(-1).id)
  assert.deepEqual(final.navigation.previous, { chapterId: chapters.at(-2).id, number: chapters.at(-2).number, title: chapters.at(-2).title })
  assert.equal(final.navigation.next, null)
  assert.equal(getChapterMetadata('chapter-not-canonical'), null)
})
