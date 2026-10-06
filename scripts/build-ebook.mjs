import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { curriculum } from '../src/data/curriculum.js'
import { validateLesson } from '../src/data/validation/lessonValidation.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const lessonDirectory = path.join(root, 'content', 'lessons')
const outputDirectory = path.join(root, 'content', 'ebooks')
const outputPdf = path.join(outputDirectory, 'briane-dev-course.pdf')
const chapters = curriculum.sections.flatMap((section) => section.chapters.map((chapter) => ({ ...chapter, section })))
const escapeHtml = (value = '') => String(value).replace(/[‐‑‒–—―−]/g, '-').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

async function loadCanonicalLessons() {
  const files = (await readdir(lessonDirectory)).filter((name) => name.endsWith('.json'))
  if (files.length !== chapters.length) throw new Error(`Expected ${chapters.length} lesson files, found ${files.length}.`)
  const lessons = new Map()
  for (const filename of files) {
    const lesson = JSON.parse(await readFile(path.join(lessonDirectory, filename), 'utf8'))
    const result = validateLesson(lesson, { filePath: path.join(lessonDirectory, filename) })
    if (!result.valid) throw new Error(`${filename}: ${result.issues.join(' ')}`)
    if (lessons.has(lesson.chapterId)) throw new Error(`Duplicate chapter ID: ${lesson.chapterId}`)
    lessons.set(lesson.chapterId, lesson)
  }
  for (const chapter of chapters) {
    const lesson = lessons.get(chapter.id)
    if (!lesson || lesson.title !== chapter.title) throw new Error(`Missing or mismatched canonical lesson ${chapter.id}.`)
  }
  return lessons
}

function renderBlock(block) {
  switch (block.type) {
    case 'heading': return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`
    case 'paragraph': return `<p>${escapeHtml(block.text)}</p>`
    case 'list': return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    case 'ordered-list': return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
    case 'code': return `<figure class="${block.filename === 'task-brief.txt' ? 'prompt' : 'code'}"><figcaption>${escapeHtml(block.filename || block.language)}${block.caption ? `<span>${escapeHtml(block.caption)}</span>` : ''}</figcaption><pre><code>${escapeHtml(block.code)}</code></pre></figure>`
    case 'callout': return `<aside class="callout ${escapeHtml(block.variant)}"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.text)}</p></aside>`
    case 'quote': return `<blockquote><p>${escapeHtml(block.text)}</p>${block.attribution ? `<cite>${escapeHtml(block.attribution)}</cite>` : ''}</blockquote>`
    case 'table': return `<table><thead><tr>${block.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    case 'image': return `<figure class="lesson-image"><figcaption>Illustration: ${escapeHtml(block.alt)}${block.caption ? ` — ${escapeHtml(block.caption)}` : ''}</figcaption></figure>`
    case 'divider': return '<hr>'
    default: throw new Error(`Unsupported lesson block: ${block.type}`)
  }
}

function renderChapter(chapter, lesson) {
  const exercises = lesson.exercises.map((exercise) => `<section class="activity"><h3>${escapeHtml(exercise.title)}${exercise.required ? ' <small>Required</small>' : ' <small>Optional</small>'}</h3><p>${escapeHtml(exercise.objective)}</p><ol>${exercise.instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join('')}</ol>${exercise.constraints.length ? `<p><strong>Constraints:</strong> ${exercise.constraints.map(escapeHtml).join('; ')}</p>` : ''}<p><strong>Expected outcome:</strong> ${escapeHtml(exercise.expectedOutcome)}</p></section>`).join('')
  const assessments = lesson.assessments.map((assessment, index) => `<section class="question"><p><strong>Question ${index + 1}${assessment.required ? ' (required)' : ''}.</strong> ${escapeHtml(assessment.prompt)}</p><ol type="A">${assessment.options.map((option) => `<li>${escapeHtml(option.text)}</li>`).join('')}</ol></section>`).join('')
  return `<article class="chapter" id="${escapeHtml(chapter.id)}"><div class="chapter-kicker">${escapeHtml(chapter.section.title)} / CHAPTER ${String(chapter.number).padStart(2, '0')}</div><h1>${escapeHtml(chapter.title)}</h1><section class="objectives"><h2>Learning objectives</h2><ul>${lesson.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ul></section><div class="lesson-content">${lesson.blocks.map(renderBlock).join('')}</div>${exercises ? `<section class="activities"><h2>Practice</h2>${exercises}</section>` : ''}${assessments ? `<section class="assessments"><h2>Knowledge check</h2><p class="answer-note">Select your answers before checking them in the course reader. The answer key is intentionally not included in this ebook.</p>${assessments}</section>` : ''}</article>`
}

function renderTocSection(section) {
  return `<div class="toc-section"><h3>Part ${section.number} — ${escapeHtml(section.title)}</h3><ol>${section.chapters.map((chapter) => `<li><a href="#${escapeHtml(chapter.id)}"><span>${escapeHtml(chapter.title)}</span><span class="toc-number">${String(chapter.number).padStart(2, '0')}</span></a></li>`).join('')}</ol></div>`
}

function renderHtml(lessons) {
  const firstSections = curriculum.sections.slice(0, 4)
  const finalSections = curriculum.sections.slice(4)
  const objectives = [
    'Choose an appropriate AI tool for a bounded software-development task.',
    'Provide useful context and constraints while protecting private information.',
    'Apply AI across planning, coding, debugging, review, testing, and maintenance.',
    'Verify claims and code using project evidence, tests, and engineering judgment.',
  ]
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AI-Powered Developer Productivity for Software Developers</title><style>
@page { size: Letter; margin: 0.68in 0.72in 0.72in; @top-right { content: "BRIANE-DEV  /  COURSE EBOOK"; color: #64748b; font: 8pt Arial, sans-serif; letter-spacing: 1pt; } @bottom-left { content: "AI-POWERED DEVELOPER PRODUCTIVITY"; color: #64748b; font: 8pt Arial, sans-serif; letter-spacing: .5pt; } @bottom-right { content: counter(page); color: #64748b; font: 9pt Arial, sans-serif; } }
@page cover { margin: 0; @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; } html { color: #172033; font: 10.2pt/1.58 Arial, Helvetica, sans-serif; } body { margin: 0; } p { margin: 0 0 10pt; } li { margin: 0 0 5pt; } h1,h2,h3,h4 { font-family: Arial, Helvetica, sans-serif; color: #0f1c2e; line-height: 1.2; break-after: avoid-page; } h2 { margin: 20pt 0 9pt; font-size: 17pt; } h3 { margin: 15pt 0 7pt; font-size: 12pt; } ul,ol { margin: 5pt 0 13pt; padding-left: 20pt; } a { color: #174d6d; text-decoration: none; }
.cover { page: cover; height: 11in; padding: .9in .9in .7in; display: flex; flex-direction: column; justify-content: center; background: #0c1929; color: #f6f8fb; position: relative; overflow: hidden; isolation: isolate; } .cover:before { content: ""; position: absolute; z-index: -1; width: 3.2in; height: 3.2in; right: -.9in; top: -1in; border: 1px solid #2a7080; border-radius: 50%; box-shadow: 0 0 0 24px #11263a, 0 0 0 25px #244b5c, 0 0 0 50px #102136, 0 0 0 51px #244b5c; opacity: .8; } .cover-mark { color: #73d0cd; font-size: 12pt; font-weight: bold; letter-spacing: 4pt; } .cover-rule { width: 65pt; height: 3pt; margin: 32pt 0 25pt; background: #59c3c0; } .cover h1 { max-width: 6.6in; color: #fff; font-size: 32pt; letter-spacing: -.8pt; line-height: 1.12; } .cover h2 { max-width: 5.8in; margin: 20pt 0 0; color: #bfceda; font-size: 15pt; font-weight: normal; line-height: 1.5; } .cover-bottom { margin-top: 70pt; color: #a8bac8; font-size: 9pt; letter-spacing: 1.2pt; }
.front-page { break-before: page; min-height: 9.35in; padding-top: .1in; } .front-page h1 { margin: 8pt 0 22pt; font-size: 26pt; letter-spacing: -.5pt; } .front-page h2 { margin-top: 18pt; } .front-eyebrow,.chapter-kicker { color: #13767b; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; text-transform: uppercase; } .front-box { margin: 14pt 0; padding: 15pt 17pt; background: #f0f5f7; border-left: 3pt solid #26a3a4; }
.toc { break-before: page; } .toc h1 { margin: 7pt 0 18pt; font-size: 28pt; } .toc-section { margin-bottom: 10pt; break-inside: avoid; } .toc-section h3 { margin: 8pt 0 4pt; padding-bottom: 4pt; border-bottom: 1px solid #d5e0e5; color: #0d6872; font-size: 9.5pt; } .toc-section ol { margin: 0; padding: 0; list-style: none; } .toc-section li { margin: 0; } .toc-section a { display: flex; justify-content: space-between; gap: 14pt; padding: 2.2pt 0; color: #243346; font-size: 8.5pt; } .toc-number { color: #748396; font: 8pt Consolas, monospace; }
.chapter { break-before: page; } .chapter-kicker { margin: 3pt 0 8pt; } .chapter > h1 { margin: 0 0 18pt; font-size: 26pt; letter-spacing: -.5pt; } .objectives { margin: 0 0 18pt; padding: 10pt 15pt 7pt; background: #f0f5f7; border-left: 3pt solid #14989b; break-inside: avoid; } .objectives h2 { margin: 0 0 7pt; font-size: 11pt; } .objectives ul { margin: 0; padding-left: 16pt; font-size: 9pt; }
.lesson-content h2 { margin-top: 19pt; } .lesson-content p { text-align: left; } .lesson-content ul,.lesson-content ol { padding-left: 21pt; } .lesson-content blockquote { margin: 14pt 0; padding: 8pt 15pt; border-left: 3pt solid #15989a; background: #eff7f7; color: #29414d; break-inside: avoid; } blockquote p { margin: 0 0 4pt; font-size: 11pt; font-style: italic; } blockquote cite { color: #657988; font-size: 8.5pt; font-style: normal; } .callout { margin: 13pt 0; padding: 10pt 13pt; background: #f1f6f8; border-left: 3pt solid #278ea0; break-inside: avoid; } .callout.warning { background: #fff7e9; border-left-color: #d49126; } .callout.tip { background: #eff8f1; border-left-color: #338859; } .callout p { margin: 4pt 0 0; } .lesson-content hr { margin: 15pt 0; border: 0; border-top: 1px solid #cbd7df; } .lesson-image { margin: 10pt 0; padding: 10pt; border: 1px dashed #9aaab7; color: #657988; font-size: 9pt; }
figure.code,figure.prompt { margin: 13pt 0; break-inside: avoid; border-radius: 3pt; overflow: hidden; } figure.code { background: #101c2d; color: #e8f0f5; } figure.prompt { background: #edf8fa; border: 1px solid #9bcdd1; color: #12384b; } figure figcaption { display: flex; justify-content: space-between; gap: 10pt; padding: 6pt 9pt; font: bold 8pt Consolas, monospace; } figure figcaption span { font: 7.5pt Arial, sans-serif; opacity: .8; text-align: right; } pre { margin: 0; padding: 9pt; white-space: pre-wrap; overflow-wrap: anywhere; font: 8pt/1.45 Consolas, "Courier New", monospace; } table { width: 100%; margin: 13pt 0; border-collapse: collapse; font-size: 8.5pt; break-inside: auto; } tr { break-inside: avoid; } th { background: #eaf1f4; color: #145b67; text-align: left; } th,td { padding: 6pt 7pt; border: 1px solid #cbd7df; vertical-align: top; }
.activities,.assessments { margin-top: 20pt; } .assessments { break-inside: avoid; } .activities > h2,.assessments > h2 { padding-top: 9pt; border-top: 1px solid #cbd7df; } .activity,.question { margin: 10pt 0; padding: 11pt 13pt; background: #f7f9fb; border: 1px solid #dfe7ec; break-inside: avoid; } .activity h3 { margin-top: 0; } .activity small { color: #687b89; font-size: 8pt; font-weight: normal; } .activity ol { margin-bottom: 7pt; } .question { background: #fff; } .question ol { margin: 6pt 0 0; } .answer-note { color: #667887; font-size: 8.5pt; font-style: italic; }
</style></head><body>
<section class="cover"><div class="cover-mark">BRIANE-DEV</div><div class="cover-rule"></div><h1>AI-POWERED DEVELOPER PRODUCTIVITY FOR SOFTWARE DEVELOPERS</h1><h2>A practical guide to using ChatGPT, GitHub Copilot, and Codex throughout the software development lifecycle</h2><div class="cover-bottom">43 CHAPTERS &nbsp; / &nbsp; 8 PARTS &nbsp; / &nbsp; CURRICULUM VERSION ${escapeHtml(curriculum.version || '1.0.0')}</div></section>
<section class="front-page"><div class="front-eyebrow">EDITION &amp; RESPONSIBLE USE</div><h1>Copyright &amp; Disclaimer</h1><p>Copyright © 2026 BrianE-Dev. All rights reserved.</p><p>This ebook is educational material for software developers. AI-generated output can be inaccurate, incomplete, insecure, or out of date. Review generated code and claims, verify behavior with appropriate tests and authoritative sources, and use engineering judgment before applying ideas to real projects.</p><p>Examples are illustrative and should be adapted to the requirements, policies, and security practices of the project where they are used. Software tools and interfaces change; check current official documentation for version-specific behavior. Readers remain responsible for decisions made in their own projects.</p><div class="front-box"><strong>Privacy reminder</strong><p>Do not share credentials, private customer information, or restricted source material with an AI service unless your organization and the service explicitly permit that use.</p></div><p>Course title and chapter names follow the BrianE-Dev curriculum, version 1.0.0.</p></section>
<section class="front-page"><div class="front-eyebrow">BRIANE-DEV</div><h1>About the Author</h1><p>This book is produced by BrianE-Dev from its written developer-productivity course. No individual author biography or professional credentials were supplied for this edition, so none are claimed here.</p><h2>About the Book</h2><p>This reading-first guide follows the approved course through eight parts and 43 chapters. It focuses on practical ways to use AI for planning, code understanding, implementation, debugging, testing, review, documentation, and maintenance while keeping technical decisions and verification with the developer.</p><p>The chapters are derived directly from the course's versioned lesson files. Each chapter includes its objectives, instruction, examples, practical activity, and knowledge-check questions. Assessment answer keys are not reproduced.</p></section>
<section class="front-page"><div class="front-eyebrow">GETTING STARTED</div><h1>Who This Book Is For</h1><p>This book is written for junior and early-career developers, frontend and backend developers, full-stack and MERN developers, and software-engineering students who want to work more effectively with AI tools.</p><h2>Prerequisites</h2><ul><li>Basic familiarity with a programming language and the purpose of source code.</li><li>Some experience reading or changing a small software project is helpful.</li><li>Access to an AI tool is useful for practice but is not required to read the book.</li></ul><div class="front-box"><strong>No AI tool is treated as an authority.</strong><p>Use the material to improve how you frame tasks, gather context, inspect suggestions, and verify outcomes.</p></div></section>
<section class="front-page"><div class="front-eyebrow">LEARNING PLAN</div><h1>Learning Objectives</h1><ul>${objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>How to Use This Book</h2><ol><li>Read the chapter objectives and identify the task they describe.</li><li>Study the workflow and example, adapting prompts to a safe, permitted project context.</li><li>Complete the practice activity and make the verification evidence explicit.</li><li>Answer the knowledge-check questions in the paid course reader, where responses are graded server-side.</li><li>Return to the relevant chapter when a similar engineering task arises.</li></ol><p>The parts build from foundational collaboration into tool-specific work, project planning, delivery, professional practice, and a repeatable personal workflow.</p></section>
<section class="front-page"><div class="front-eyebrow">COURSE &amp; CERTIFICATE</div><h1>Course Information</h1><p>The BrianE-Dev course contains eight sections and 43 canonical chapters. This ebook is included with paid course access and is generated from the same lesson content used by the course reader.</p><p>Course completion is recorded by the learning platform against stable chapter IDs. A Certificate of Completion is issued when the authenticated learner has a verified course purchase, completes all 43 chapters, and satisfies every required assessment and exercise.</p><div class="front-box"><strong>Certificate verification</strong><p>Issued certificates include a unique ID and can be checked through the public BrianE-Dev certificate verification endpoint. A certificate is not a statement of accreditation or a degree.</p></div><p>To follow chapter navigation, complete assessments, record progress, access the ebook, or download an issued certificate, sign in to the BrianE-Dev learner space.</p></section>
<section class="toc"><h1>Contents</h1>${firstSections.map(renderTocSection).join('')}</section><section class="toc"><h1>Contents <small>continued</small></h1>${finalSections.map(renderTocSection).join('')}</section>
${chapters.map((chapter) => renderChapter(chapter, lessons.get(chapter.id))).join('')}
</body></html>`
}

async function findBrowser() {
  const candidates = [
    process.env.PDF_BROWSER,
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try { if ((await stat(candidate)).isFile()) return candidate } catch { /* try the next installed browser */ }
  }
  throw new Error('Install Chromium, Microsoft Edge, or Google Chrome, or set PDF_BROWSER to its executable path.')
}

const lessons = await loadCanonicalLessons()
const html = renderHtml(lessons)
await mkdir(outputDirectory, { recursive: true })
const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'briane-dev-ebook-'))
try {
  const htmlPath = path.join(tempDirectory, 'ebook.html')
  const pdfPath = path.join(tempDirectory, 'briane-dev-course.pdf')
  await writeFile(htmlPath, html, 'utf8')
  const browserPath = await findBrowser()
  const result = spawnSync(browserPath, [
    '--headless=new', '--disable-gpu', '--disable-gpu-sandbox', '--disable-extensions', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--no-pdf-header-footer', `--user-data-dir=${path.join(tempDirectory, 'browser-profile')}`,
    `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { encoding: 'utf8', timeout: 180000, windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Chromium PDF generation failed: ${result.stderr || result.stdout}`)
  const pdfInfo = await stat(pdfPath)
  if (pdfInfo.size < 10000 || (await readFile(pdfPath)).subarray(0, 5).toString() !== '%PDF-') throw new Error('Generated ebook PDF is empty or invalid.')
  const pdf = await readFile(pdfPath)
  const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
  if (pageCount < 45) throw new Error(`Generated ebook has only ${pageCount} pages; expected a complete course book.`)
  await writeFile(outputPdf, pdf)
  console.log(`Built ${path.relative(root, outputPdf)} (${pageCount} pages, ${pdfInfo.size} bytes, ${chapters.length} chapters).`)
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
