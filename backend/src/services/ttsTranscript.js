import crypto from 'node:crypto'
import { getLessonByChapterId } from './lessonRepository.js'

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, 'web link')
    .replace(/\bwww\.\S+/gi, 'web link')
    .replace(/[`*_~#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function blockSegments(block) {
  switch (block.type) {
    case 'heading': return [`${block.text}.`]
    case 'paragraph': return [cleanText(block.text)]
    case 'list':
    case 'ordered-list': return block.items.map((item) => cleanText(item))
    case 'quote': return [cleanText(block.text)]
    case 'callout': return [`${block.title}. ${cleanText(block.text)}`]
    case 'table': return [
      `The following table has columns ${block.headers.map(cleanText).join(', ')}.`,
      ...block.rows.map((row) => row.map((cell, index) => `${cleanText(block.headers[index])}: ${cleanText(cell)}`).join('. ')),
    ]
    case 'image': return [cleanText(block.caption || block.alt)]
    case 'code': return [block.caption
      ? `Code example. ${cleanText(block.caption)}`
      : 'The following code example demonstrates the software development concept discussed in this lesson.']
    case 'divider': return []
    default: return []
  }
}

export function buildTtsTranscript(lesson) {
  const sections = [cleanText(lesson.title)]
  for (const objective of lesson.objectives || []) sections.push(cleanText(objective))
  for (const block of lesson.blocks || []) sections.push(...blockSegments(block))
  for (const exercise of lesson.exercises || []) {
    sections.push(`Practice activity. ${cleanText(exercise.title)}. ${cleanText(exercise.objective)}`)
    for (const instruction of exercise.instructions || []) sections.push(cleanText(instruction))
  }
  return sections.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function hashTranscript(transcript) {
  return crypto.createHash('sha256').update(transcript, 'utf8').digest('hex')
}

export async function loadTtsTranscript(chapterId, options) {
  const lesson = await getLessonByChapterId(chapterId, options)
  return { lesson, transcript: buildTtsTranscript(lesson), transcriptHash: hashTranscript(buildTtsTranscript(lesson)) }
}
