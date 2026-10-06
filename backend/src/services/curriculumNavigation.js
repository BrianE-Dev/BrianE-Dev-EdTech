import { curriculum } from '../../../src/data/curriculum.js'

const chapterSequence = curriculum.sections.flatMap((section) => section.chapters.map((chapter) => ({
  ...chapter,
  sectionId: section.id,
  sectionNumber: section.number,
  sectionTitle: section.title,
})))

function navigationItem(chapter) {
  return chapter ? { chapterId: chapter.id, number: chapter.number, title: chapter.title } : null
}

export function getChapterMetadata(chapterId) {
  const index = chapterSequence.findIndex((chapter) => chapter.id === chapterId)
  if (index < 0) return null
  const chapter = chapterSequence[index]
  return {
    chapter: {
      chapterId: chapter.id,
      number: chapter.number,
      sectionId: chapter.sectionId,
      sectionNumber: chapter.sectionNumber,
      sectionTitle: chapter.sectionTitle,
    },
    navigation: {
      previous: navigationItem(chapterSequence[index - 1]),
      next: navigationItem(chapterSequence[index + 1]),
    },
  }
}
