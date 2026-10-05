import assert from 'node:assert/strict'
import test from 'node:test'
import { CURRICULUM_VERSION, curriculum, totalChapters, totalSections } from '../src/data/curriculum.js'
import { validateCurriculum } from '../src/data/validation/curriculumValidation.js'

// This fixed test oracle guards the approved baseline; runtime consumers use curriculum.js only.
const approved = [
  ['section-modern-ai-developer-workflow', 'Modern AI Developer Workflow', [
    ['chapter-ai-assisted-developer', 'The AI-Assisted Developer'],
    ['chapter-choosing-the-right-ai-tool', 'Choosing the Right AI Tool'],
    ['chapter-prompting-for-software-development', 'Prompting for Software Development'],
    ['chapter-when-not-to-use-ai', 'When NOT to Use AI'],
  ]],
  ['section-chatgpt-for-developers', 'ChatGPT for Developers', [
    ['chapter-chatgpt-as-a-development-assistant', 'ChatGPT as a Development Assistant'],
    ['chapter-debugging-with-chatgpt', 'Debugging with ChatGPT'],
    ['chapter-refactoring-and-improving-existing-code', 'Refactoring and Improving Existing Code'],
    ['chapter-frameworks-libraries-and-documentation', 'Frameworks, Libraries, and Documentation'],
    ['chapter-understanding-errors-and-stack-traces', 'Understanding Errors and Stack Traces'],
    ['chapter-apis-sql-and-development-questions', 'APIs, SQL, and Development Questions'],
    ['chapter-architecture-and-technical-reasoning', 'Architecture and Technical Reasoning'],
  ]],
  ['section-github-copilot', 'GitHub Copilot', [
    ['chapter-getting-started-with-github-copilot', 'Getting Started with GitHub Copilot'],
    ['chapter-intelligent-autocomplete', 'Intelligent Autocomplete'],
    ['chapter-generating-code-with-copilot', 'Generating Code with Copilot'],
    ['chapter-writing-tests-with-copilot', 'Writing Tests with Copilot'],
    ['chapter-refactoring-with-copilot', 'Refactoring with Copilot'],
    ['chapter-copilot-as-a-pair-programmer', 'Copilot as a Pair Programmer'],
  ]],
  ['section-codex-for-software-engineering', 'Codex for Software Engineering', [
    ['chapter-understanding-codex', 'Understanding Codex'],
    ['chapter-generating-and-editing-code', 'Generating and Editing Code'],
    ['chapter-multi-file-changes', 'Multi-File Changes'],
    ['chapter-explaining-existing-codebases', 'Explaining Existing Codebases'],
    ['chapter-handling-larger-development-tasks', 'Handling Larger Development Tasks'],
    ['chapter-chatgpt-vs-github-copilot-vs-codex', 'ChatGPT vs GitHub Copilot vs Codex'],
  ]],
  ['section-planning-the-project-with-ai', 'Planning the Project with AI', [
    ['chapter-planning-a-software-project-with-chatgpt', 'Planning a Software Project with ChatGPT'],
    ['chapter-turning-requirements-into-tasks', 'Turning Requirements into Tasks'],
    ['chapter-designing-features-and-user-flows', 'Designing Features and User Flows'],
    ['chapter-choosing-technologies-and-architecture', 'Choosing Technologies and Architecture'],
    ['chapter-creating-a-development-roadmap', 'Creating a Development Roadmap'],
    ['chapter-using-ai-during-implementation', 'Using AI During Implementation'],
  ]],
  ['section-building-debugging-and-testing-with-ai', 'Building, Debugging, and Testing with AI', [
    ['chapter-generating-application-code', 'Generating Application Code'],
    ['chapter-working-with-frontend-development', 'Working with Frontend Development'],
    ['chapter-working-with-backend-development', 'Working with Backend Development'],
    ['chapter-working-with-databases', 'Working with Databases'],
    ['chapter-api-integration-and-testing', 'API Integration and Testing'],
    ['chapter-debugging-complex-problems', 'Debugging Complex Problems'],
    ['chapter-automated-testing-and-quality-assurance', 'Automated Testing and Quality Assurance'],
  ]],
  ['section-professional-ai-assisted-software-engineering', 'Professional AI-Assisted Software Engineering', [
    ['chapter-code-review-with-ai', 'Code Review with AI'],
    ['chapter-documentation-with-ai', 'Documentation with AI'],
    ['chapter-security-privacy-and-responsible-ai-use', 'Security, Privacy, and Responsible AI Use'],
    ['chapter-git-version-control-and-ai-assisted-workflows', 'Git, Version Control, and AI-Assisted Workflows'],
    ['chapter-maintaining-and-improving-ai-assisted-codebases', 'Maintaining and Improving AI-Assisted Codebases'],
  ]],
  ['section-building-your-ai-powered-developer-workflow', 'Building Your AI-Powered Developer Workflow', [
    ['chapter-designing-your-personal-ai-development-workflow', 'Designing Your Personal AI Development Workflow'],
    ['chapter-the-ai-powered-developer-putting-everything-together', 'The AI-Powered Developer: Putting Everything Together'],
  ]],
]

test('curriculum is version 1.0.0 with eight sections and 43 chapters', () => {
  assert.equal(CURRICULUM_VERSION, '1.0.0')
  assert.equal(totalSections, 8)
  assert.equal(totalChapters, 43)
  assert.equal(curriculum.sections.length, 8)
})

test('section IDs, titles, display order, and chapter IDs/titles exactly match the approved baseline', () => {
  assert.deepEqual(curriculum.sections.map((section) => [
    section.id,
    section.title,
    section.order,
    section.chapters.map(({ id, title }) => [id, title]),
  ]), approved.map(([id, title, chapters], index) => [id, title, index + 1, chapters]))
})

test('chapter numbers and global display order run from 1 through 43', () => {
  const chapters = curriculum.sections.flatMap((section) => section.chapters)
  assert.deepEqual(chapters.map(({ number }) => number), Array.from({ length: 43 }, (_, index) => index + 1))
  assert.deepEqual(chapters.map(({ order }) => order), Array.from({ length: 43 }, (_, index) => index + 1))
})

test('all section and chapter IDs are unique and literal', () => {
  const sections = curriculum.sections
  const chapters = sections.flatMap((section) => section.chapters)
  assert.equal(new Set(sections.map(({ id }) => id)).size, 8)
  assert.equal(new Set(chapters.map(({ id }) => id)).size, 43)
  assert.ok(sections.every(({ id }) => /^section-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)))
  assert.ok(chapters.every(({ id }) => /^chapter-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)))
  assert.ok(chapters.some(({ id }) => id === 'chapter-ai-assisted-developer'))
  assert.ok(chapters.some(({ id }) => id === 'chapter-understanding-codex'))
  assert.ok(chapters.some(({ id }) => id === 'chapter-the-ai-powered-developer-putting-everything-together'))
})

test('curriculum integrity validator reports actionable errors', () => {
  assert.deepEqual(validateCurriculum(), { valid: true, issues: [] })
  const invalid = structuredClone(curriculum)
  invalid.sections[0].chapters[0].id = invalid.sections[0].chapters[1].id
  invalid.sections[0].chapters[1].order = 99
  const result = validateCurriculum(invalid)
  assert.equal(result.valid, false)
  assert.ok(result.issues.some((issue) => issue.includes('Chapter ID') && issue.includes('duplicated')))
  assert.ok(result.issues.some((issue) => issue.includes('Global chapter order') && issue.includes('expected 2')))
})
