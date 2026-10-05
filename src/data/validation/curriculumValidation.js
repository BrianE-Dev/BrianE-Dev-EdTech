import { curriculum } from '../curriculum.js'

function addDuplicateIssues(items, getId, label, issues) {
  const seen = new Set()
  for (const item of items) {
    const id = getId(item)
    if (!id) continue
    if (seen.has(id)) issues.push(`${label} ID "${id}" is duplicated.`)
    seen.add(id)
  }
}

function checkSequence(items, getValue, label, issues) {
  items.forEach((item, index) => {
    const expected = index + 1
    const actual = getValue(item)
    if (actual !== expected) issues.push(`${label} at position ${expected} has value ${JSON.stringify(actual)}; expected ${expected}.`)
  })
}

export function validateCurriculum(value = curriculum) {
  const issues = []
  if (!value || !Array.isArray(value.sections)) {
    return { valid: false, issues: ['Curriculum must contain a sections array.'] }
  }

  if (value.sections.length !== 8) issues.push(`Curriculum has ${value.sections.length} sections; expected 8.`)
  checkSequence(value.sections, (section) => section.order, 'Section order', issues)
  checkSequence(value.sections, (section) => section.number, 'Section number', issues)
  addDuplicateIssues(value.sections, (section) => section.id, 'Section', issues)

  const chapters = []
  for (const [sectionIndex, section] of value.sections.entries()) {
    const sectionLabel = `Section ${sectionIndex + 1}${section.title ? ` (${section.title})` : ''}`
    if (typeof section.id !== 'string' || !section.id.startsWith('section-')) issues.push(`${sectionLabel} must have a literal stable ID beginning with "section-".`)
    if (typeof section.title !== 'string' || !section.title.trim()) issues.push(`${sectionLabel} must have a non-empty title.`)
    if (!Array.isArray(section.chapters)) {
      issues.push(`${sectionLabel} must contain a chapters array.`)
      continue
    }
    chapters.push(...section.chapters.map((chapter) => ({ ...chapter, sectionLabel })))
  }

  if (chapters.length !== 43) issues.push(`Curriculum has ${chapters.length} chapters; expected 43.`)
  checkSequence(chapters, (chapter) => chapter.number, 'Global chapter number', issues)
  checkSequence(chapters, (chapter) => chapter.order, 'Global chapter order', issues)
  addDuplicateIssues(chapters, (chapter) => chapter.id, 'Chapter', issues)
  const seenTitles = new Set()

  for (const chapter of chapters) {
    if (typeof chapter.id !== 'string' || !chapter.id.startsWith('chapter-')) {
      issues.push(`${chapter.sectionLabel}, chapter ${chapter.number ?? '?'} must have a literal stable ID beginning with "chapter-".`)
    }
    if (typeof chapter.title !== 'string' || !chapter.title.trim()) {
      issues.push(`${chapter.sectionLabel}, chapter ${chapter.number ?? '?'} must have a non-empty title.`)
    } else if (seenTitles.has(chapter.title)) {
      issues.push(`${chapter.sectionLabel}, chapter ${chapter.number} repeats chapter title "${chapter.title}"; chapter titles must map to one identity.`)
    }
    if (chapter.title) seenTitles.add(chapter.title)
  }

  return { valid: issues.length === 0, issues }
}

export function assertValidCurriculum(value = curriculum) {
  const result = validateCurriculum(value)
  if (!result.valid) throw new Error(`Curriculum validation failed:\n${result.issues.map((issue) => `- ${issue}`).join('\n')}`)
  return value
}
