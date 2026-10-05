# BRIANE-DEV UNIFIED CODEX MASTER PROMPT

## EBOOK + PDF + REACT COURSE PLATFORM + TTS + PROGRESS + EXERCISES + CERTIFICATES

---

# 1. ROLE

You are acting as the senior software engineer, technical architect, technical author, instructional designer, UI implementation engineer, document-production engineer, QA engineer, and content-system architect for the BrianE-Dev platform.

You are responsible for producing two connected educational products from one authoritative curriculum:

### PRODUCT A — BrianE-Dev Ebook

A complete professional technical ebook containing the approved 8-section / 43-chapter curriculum, practical examples, code, exercises, knowledge checks, diagrams, and supporting material.

### PRODUCT B — BrianE-Dev Online Course

A production-quality React course platform implementing the same curriculum through interactive lessons, TTS, progress tracking, exercises, knowledge checks, course completion, and certificate support.

These are NOT two independent projects.

They must share one authoritative educational content model.

The final architecture must prevent the ebook and website course from drifting into different versions of the curriculum.

---

# 2. PRIMARY PRODUCT

## Book Title

**AI-POWERED DEVELOPER PRODUCTIVITY FOR SOFTWARE DEVELOPER**

## Subtitle

**A Practical Guide to Using ChatGPT, GitHub Copilot, and Codex Throughout the Software Development Lifecycle**

## Brand

**BrianE-Dev**

Use the exact spelling:

**BrianE-Dev**

Do not change the brand spelling.

---

# 3. CORE ARCHITECTURE PRINCIPLE

The most important architectural requirement is:

> **ONE AUTHORITATIVE CURRICULUM → MULTIPLE PRESENTATION FORMATS**

The authoritative educational content should power:

1. Ebook manuscript
2. PDF
3. Course landing page
4. Course dashboard
5. Section pages
6. Chapter/lesson pages
7. TTS content
8. Exercises
9. Knowledge checks
10. Progress tracking
11. Course completion
12. Certificate eligibility

Do NOT independently rewrite the curriculum for the website.

Do NOT create a different chapter structure for the ebook.

Do NOT create duplicate lesson content that can drift from the manuscript.

Create a structured content model that can be consumed by both the ebook pipeline and the React application.

---

# 4. EXECUTION MODEL AND REPOSITORY AUTHORITY

Existing repository architecture takes precedence over hypothetical architecture in this prompt. Inspect before changing anything, reuse suitable existing systems, and extend them where needed. Do not replace working infrastructure merely because this prompt describes another option.

Before introducing or changing authentication, authorization, database technology, API infrastructure, payment, TTS, enrollment, progress, certificates, admin functionality, routing, or UI components, inspect what the repository already provides. Treat these as conditional capabilities, not assumptions. If a required capability is missing, include it in the approved implementation plan before building it. Do not add unnecessary infrastructure.

Work through these approval checkpoints:

1. **Phase 1 — Repository Inspection (read-only):** inspect and report findings only. Make no file changes.
2. **Checkpoint — Await approval:** stop after the Phase 1 report. Do not plan implementation in detail or begin implementation until approved.
3. **Phase 2 — Implementation Plan:** after approval, propose a concrete, repository-specific plan, including files/systems affected, sequence, dependencies, and risks.
4. **Checkpoint — Await approval:** stop and wait for approval of that plan.
5. **Phase 3 — Implementation:** implement the approved plan incrementally. Do not expand its scope without reporting the reason and obtaining direction where the change is material.
6. **Phase 4 — QA and Validation:** run applicable tests, build/lint/type checks, curriculum integrity checks, PDF validation, responsive/accessibility checks, and other relevant QA. Report results accurately.

The complete desired end state is described in this prompt, but it is not authorization to perform every part in one uncontrolled operation. “START NOW” means begin Phase 1 only. It never authorizes implementation.

Detailed requirements are defined in their relevant subject sections. Later workflow, Definition of Done, and final-report sections are summaries/checklists; they do not introduce a second specification.

---

## PHASE 1 INSPECTION REQUIREMENTS

Phase 1 is read-only. Do not modify, create, delete, rename, move, or generate repository files. Inspect:

* repository structure and the React application, routing, components, styles, and design system;
* backend/API conventions, database implementation, authentication, authorization, and admin functionality;
* payment/Paystack, enrollment, progress, certificate, and TTS systems;
* the canonical curriculum file specified in Section 6 and all other curriculum/content sources;
* ebook/manuscript assets and PDF-generation tools;
* package scripts, dependencies, environment configuration (without exposing secrets), tests, and build configuration.

At the end of Phase 1, provide a concise but technically detailed report covering: (1) current architecture, (2) reusable systems, (3) curriculum schema and structure, (4) curriculum discrepancies, (5) missing functionality, (6) risks/conflicts, (7) recommended implementation sequence, (8) files that would be modified, and (9) files that should remain untouched. Identify evidence and uncertainty. Then stop and wait for approval.

---

# 5. AUTHORITATIVE CURRICULUM

`src/data/curriculum.js` is the canonical and authoritative curriculum source for the BrianE-Dev course. Inspect it during Phase 1 and preserve its existing structure. Do not delete, rename, move, replace, or arbitrarily restructure it. Preserve existing IDs, slugs, identifiers, fields, nesting, imports, and consumers unless an approved plan establishes an absolutely necessary compatible change.

Do not create a competing curriculum definition or hardcode another section/chapter list in the frontend, backend, or ebook pipeline. Course navigation, routes, progress references, exercises, assessments, TTS, completion, certificate eligibility, and ebook/PDF ordering must derive from this canonical source. Detailed supporting lesson/exercise/assessment/TTS/ebook content may live separately when appropriate, but it must reference stable identifiers from `src/data/curriculum.js` and must not redefine course structure or ordering.

Resolve curriculum authority in this order:

1. Existing `src/data/curriculum.js`.
2. Other existing authoritative curriculum/content sources discovered during inspection.
3. The approved target structure stated in this prompt.

The approved target is **8 sections and 43 chapters**, as listed in Section 6. This target is not permission to overwrite or silently reconcile the canonical file. If it conflicts with `src/data/curriculum.js` or another authoritative source, report the exact discrepancy during Phase 1 and stop for direction. If the curriculum is incomplete, report what is missing and wait. Do not make curriculum changes during Phase 1.

# 6. APPROVED 8-SECTION CURRICULUM

The approved target structure is:

## SECTION 1 — MODERN AI DEVELOPER WORKFLOW

1. The AI-Assisted Developer
2. Choosing the Right AI Tool
3. Prompting for Software Development
4. When NOT to Use AI

---

## SECTION 2 — CHATGPT FOR DEVELOPERS

5. ChatGPT as a Development Assistant
6. Debugging with ChatGPT
7. Refactoring and Improving Existing Code
8. Frameworks, Libraries, and Documentation
9. Understanding Errors and Stack Traces
10. APIs, SQL, and Development Questions
11. Architecture and Technical Reasoning

---

## SECTION 3 — GITHUB COPILOT

12. Getting Started with GitHub Copilot
13. Intelligent Autocomplete
14. Generating Code with Copilot
15. Writing Tests with Copilot
16. Refactoring with Copilot
17. Copilot as a Pair Programmer

---

## SECTION 4 — CODEX FOR SOFTWARE ENGINEERING

18. Understanding Codex
19. Generating and Editing Code
20. Multi-File Changes
21. Explaining Existing Codebases
22. Handling Larger Development Tasks
23. ChatGPT vs GitHub Copilot vs Codex

---

## SECTION 5 — PLANNING THE PROJECT WITH AI

24. Planning a Software Project with ChatGPT
25. Turning Requirements into Tasks
26. Designing Features and User Flows
27. Choosing Technologies and Architecture
28. Creating a Development Roadmap
29. Using AI During Implementation

---

## SECTION 6 — BUILDING, DEBUGGING, AND TESTING WITH AI

30. Generating Application Code
31. Working with Frontend Development
32. Working with Backend Development
33. Working with Databases
34. API Integration and Testing
35. Debugging Complex Problems
36. Automated Testing and Quality Assurance

---

## SECTION 7 — PROFESSIONAL AI-ASSISTED SOFTWARE ENGINEERING

37. Code Review with AI
38. Documentation with AI
39. Security, Privacy, and Responsible AI Use
40. Git, Version Control, and AI-Assisted Workflows
41. Maintaining and Improving AI-Assisted Codebases

---

## SECTION 8 — BUILDING YOUR AI-POWERED DEVELOPER WORKFLOW

42. Designing Your Personal AI Development Workflow
43. The AI-Powered Developer: Putting Everything Together

---

# 7. CONTENT MODEL

Do not make the website directly depend on manually duplicated page content.

Create a structured educational content system.

A suitable conceptual structure is:

```text
content/
├── curriculum/
│   ├── sections/
│   ├── chapters/
│   ├── lessons/
│   ├── exercises/
│   └── assessments/
│
├── ebook/
│
└── shared/
```

The exact implementation may differ depending on the existing application architecture.

Each lesson/chapter should have structured metadata such as:

```text
id
sectionId
chapterNumber
title
slug
description
objectives
content
ttsContent
codeExamples
exercises
knowledgeChecks
estimatedDuration
prerequisites
```

Where appropriate.

Do not duplicate large blocks of educational content unnecessarily.

---

# 8. LESSON CONTENT MODEL

A course lesson should support:

```text
Lesson
├── metadata
├── introduction
├── learning objectives
├── lesson content
├── examples
├── code
├── callouts
├── practical exercise
├── knowledge checks
├── summary
└── completion state
```

The content should be suitable for both visual reading and TTS.

---

# 9. TTS CONTENT

The TTS system must use the lesson's authoritative educational content.

Do not maintain a completely separate manually written narration unless there is a strong technical reason.

Where narration differs from visual content, maintain it as an explicit structured field.

Example:

```text
lesson.content
lesson.ttsContent
```

The TTS content should remain synchronized with the lesson.

---

# 10. COURSE WEBSITE

The existing website must remain a **React frontend**.

## HARD REQUIREMENT

The frontend must be implemented strictly using React.

Do NOT create the course frontend using:

* standalone HTML pages
* static HTML templates
* a separate frontend framework
* unrelated frontend architecture

Use the existing React application and routing architecture.

Reuse existing:

* components
* design tokens
* styling system
* authentication
* API layer
* state management
* utilities

where appropriate.

Do not introduce unnecessary dependencies.

---

# 11. COURSE PAGES

Implement the complete course experience.

At minimum, support:

## Course Landing Page

Include:

* course title
* subtitle
* description
* instructor/author
* target audience
* prerequisites
* learning objectives
* curriculum overview
* 8 sections
* 43 chapters
* estimated learning commitment
* certificate information
* course benefits
* CTA
* purchase/enrollment state

---

# 12. COURSE DASHBOARD

Authenticated learners should have a dedicated course dashboard.

Show:

* overall progress
* completed lessons
* current lesson
* remaining lessons
* section progress
* chapter progress
* course completion percentage
* recent activity
* certificate status

Example:

```text
AI-Powered Developer Productivity

Overall Progress
████████████░░░░░░ 68%

Continue Learning
Chapter 20 — Multi-File Changes

Sections
✓ Section 1     100%
✓ Section 2     100%
✓ Section 3     100%
▶ Section 4      50%
○ Section 5       0%
○ Section 6       0%
○ Section 7       0%
○ Section 8       0%
```

---

# 13. CURRICULUM NAVIGATION

Create a clear curriculum navigator.

Hierarchy:

```text
Course
 ├── Section
 │    ├── Chapter
 │    │    ├── Lesson content
 │    │    ├── Exercise
 │    │    └── Knowledge check
 │    └── ...
 └── ...
```

Users should always know:

* where they are
* what they completed
* what comes next
* what remains locked
* why something is locked

---

# 14. LESSON PAGE

Create a polished lesson interface.

Recommended structure:

```text
SECTION 4
CODEX FOR SOFTWARE ENGINEERING

Chapter 20
Multi-File Changes

[ TTS PLAYER ]

────────────────────────

Learning Objectives

...

Lesson Content

...

Code Example

...

Practical Example

...

Exercise

...

Knowledge Check

...

Chapter Summary

────────────────────────

[ Previous ]       [ Mark Complete ]       [ Next ]
```

The exact UI should follow the existing BrianE-Dev design system.

---

# 15. TTS PLAYER

Build a dedicated BrianE-Dev TTS player.

The player should support, where the chosen browser/API architecture allows:

* play
* pause
* resume
* stop
* previous
* next
* playback progress
* elapsed time
* remaining time
* playback speed
* voice selection
* volume
* mute
* auto-advance
* loading state
* error state
* unavailable state

Use accessible controls.

Each control must have an accessible name.

Example:

```text
Play lesson
Pause lesson
Change playback speed
Select voice
Mute audio
Skip forward
Skip backward
```

---

# 16. TTS IMPLEMENTATION

Inspect the existing architecture and choose the appropriate implementation.

If browser-native speech synthesis is appropriate, encapsulate it behind a reusable TTS service.

If the platform already has or is designed for a server-side TTS provider, integrate through the existing backend architecture.

Do not hard-code provider credentials into the React frontend.

Do not expose secret API keys.

Use environment variables and server-side handling where required.

---

# 17. TTS PLAYER STATES

Implement explicit states:

### Idle

Lesson ready to play.

### Loading

Audio/voice is initializing.

### Playing

Audio actively playing.

### Paused

Playback paused.

### Completed

Lesson narration completed.

### Error

Playback failed.

### Unsupported

TTS is unavailable.

### Mobile

Ensure controls remain usable on smaller screens.

---

# 18. TTS ACCESSIBILITY

The TTS experience must not prevent normal reading.

Users must be able to:

* read without audio
* pause audio
* restart audio
* control playback
* navigate normally

Do not make TTS mandatory.

Respect browser/device accessibility settings where applicable.

---

# 19. PROGRESS TRACKING

Progress must be persistent.

Track at minimum:

```text
userId
courseId
sectionId
chapterId
lessonId
startedAt
lastAccessedAt
completedAt
progressPercentage
```

Use the existing backend/database architecture where available.

Do not store important persistent progress solely in localStorage.

Local state may be used as a temporary UX optimization, but the server must be authoritative for authenticated learner progress.

---

# 20. PROGRESS RULES

Define clear completion behavior.

A lesson may become complete when:

* the learner explicitly marks it complete

or

* the configured completion criteria are satisfied.

Do not automatically mark every lesson complete merely because it was opened.

If TTS is used as part of completion logic, make this intentional and transparent.

The learner should be able to see:

* completed
* in progress
* not started

---

# 21. RESUME LEARNING

When the learner returns to the course:

* restore their latest course state
* identify the last active lesson
* provide a Continue Learning action

Example:

```text
Welcome back.

Continue where you left off:
Chapter 20 — Multi-File Changes

[ Continue Lesson ]
```

---

# 22. EXERCISE SYSTEM

Each appropriate chapter must have a practical exercise.

Exercises should be tied to the authoritative curriculum.

Exercise structure:

```text
Exercise
├── title
├── objective
├── context
├── instructions
├── constraints
├── expected outcome
└── verification criteria
```

Exercises should progressively increase in difficulty.

---

# 23. KNOWLEDGE CHECK SYSTEM

Implement knowledge checks for lessons/chapters where appropriate.

Support question types such as:

* multiple choice
* true/false
* scenario-based questions

Where appropriate, store:

* question
* options
* correct answer
* explanation

Do not expose the correct answer in the initial rendered markup in a way that defeats the assessment.

---

# 24. KNOWLEDGE CHECK UX

After submission:

* show whether the answer is correct
* explain the reasoning
* allow retry where appropriate
* track completion

Do not make assessments unnecessarily punitive.

The objective is learning.

---

# 25. COURSE COMPLETION

Define a clear completion model.

A learner should not receive a certificate merely because they purchased the course.

Certificate eligibility should be based on defined completion requirements.

At minimum consider:

* required lessons completed
* required knowledge checks completed
* required exercises completed
* final course completion state

The exact requirements should be configurable.

---

# 26. CERTIFICATE SUPPORT

Inspect whether certificate support already exists. Reuse and extend a suitable implementation. If it is absent, include any required certificate work in the approved implementation plan before building it; do not assume a new certificate system is needed.

Certificate data should include, where appropriate:

* learner name
* course name
* completion date
* certificate ID
* BrianE-Dev branding
* author/instructor information
* verification mechanism

Do not make unsupported accreditation claims.

Do not call the certificate an accredited certification unless the project explicitly provides that accreditation.

---

# 27. CERTIFICATE VERIFICATION

Where certificate issuance is in scope, inspect for an existing verification mechanism and reuse it. If none exists, propose an appropriate mechanism in the approved implementation plan.

For example:

```text
Certificate ID:
BRI-2026-XXXXXX
```

A public verification page could allow:

```text
/certificate/verify/:certificateId
```

The page should show only appropriate certificate information.

Do not expose private learner information unnecessarily.

---

# 28. CERTIFICATE GENERATION

Inspect the existing backend and certificate flow. Reuse suitable existing generation/issuance support. If certificate generation is required but absent, plan it before implementation.

The certificate may be generated:

* server-side
* through a controlled PDF-generation service
* through an existing document-generation pipeline

Do not generate certificates only on the client if that would allow users to manipulate certificate records.

Certificate issuance should be server-authoritative.

---

# 29. AUTHENTICATION AND ACCESS

Inspect authentication and authorization first. Reuse suitable existing systems; if either is absent and required for the approved scope, include its addition in the implementation plan.

Support appropriate states:

* unauthenticated
* authenticated
* enrolled
* not enrolled
* course completed

Do not expose paid course content to unauthorized users through client-side hiding alone.

Server-side authorization must protect protected content/data where the existing architecture supports it.

---

# 30. PAYMENT / ENROLLMENT

Inspect payment and enrollment implementation first. These are conditional capabilities: do not add a payment provider or enrollment system unless required by the approved scope and absent from the repository.

If Paystack is already part of the project:

* reuse the existing integration
* keep secret keys server-side
* use test keys during development
* structure configuration so live keys can be supplied later

Do not invent a second payment system.

Enrollment should be linked to verified payment state.

Do not grant permanent course access merely because the frontend reports a successful payment.

---

# 31. COURSE ACCESS MODEL

Support states such as:

```text
Visitor
↓
Course Landing Page
↓
Purchase
↓
Payment Verification
↓
Enrollment
↓
Course Dashboard
↓
Lessons
↓
Completion
↓
Certificate Eligibility
↓
Certificate Issued
```

The backend should be authoritative for enrollment status.

---

# 32. DATABASE

Inspect the existing database.

Do not introduce a new database technology unnecessarily.

If MongoDB is already the selected project database, use the existing MongoDB architecture.

If PostgreSQL is already established, use it.

Do not migrate databases solely because you prefer another technology.

If the approved scope requires persistent course data that the existing schema does not support, plan the minimum appropriate models/collections/tables for:

* courses
* sections
* chapters/lessons
* enrollments
* progress
* exercises
* assessment attempts
* certificates

Only introduce separate persistent entities where they provide real value.

---

# 33. API DESIGN

Use the existing API conventions.

Potential endpoints may include:

```text
GET    /api/courses
GET    /api/courses/:courseId
GET    /api/courses/:courseId/curriculum
GET    /api/lessons/:lessonId

GET    /api/me/progress
PUT    /api/me/progress/:lessonId

POST   /api/lessons/:lessonId/complete

GET    /api/lessons/:lessonId/exercises
GET    /api/lessons/:lessonId/knowledge-check

POST   /api/knowledge-checks/:id/attempt

GET    /api/certificates
GET    /api/certificates/:id
GET    /api/certificates/verify/:certificateId
```

These are examples, not mandatory endpoint names.

Follow the existing API architecture.

---

# 34. ADMIN / CONTENT MANAGEMENT

If the existing project contains an admin dashboard, integrate course management appropriately.

Where practical, support administrative management of:

* course status
* sections
* lessons
* exercises
* knowledge checks
* certificate settings
* learner progress
* enrollments

Do not create an unnecessarily complex CMS if the current application does not require one.

---

# 35. COURSE CONTENT VERSIONING

Because the ebook and website share content, design the system so future content changes can be controlled.

Avoid silently changing completed course content in ways that invalidate learner progress.

Where practical, maintain:

* content version
* published status
* draft status

Do not over-engineer this unless necessary.

---

# 36. EBOOK FRONT MATTER

Use this exact order:

1. Title Page
2. Copyright / Disclaimer
3. About the Author
4. About the Book
5. Who This Book Is For
6. Prerequisites
7. Learning Objectives
8. How to Use This Book
9. Course & Certificate Information
10. Table of Contents

---

# 37. EBOOK CHAPTER STRUCTURE

Each chapter should contain, where appropriate:

1. Chapter title
2. Introduction
3. Learning objectives
4. Core concept
5. Practical explanation
6. AI workflow
7. Code examples
8. Common mistakes
9. Best practices
10. Practical exercise
11. Knowledge check
12. Chapter summary

Do not force elements where they are pedagogically inappropriate.

---

# 38. COURSE LESSON STRUCTURE

The online lesson should adapt the chapter into a more interactive experience.

A typical lesson can contain:

```text
Lesson introduction
↓
Learning objectives
↓
Core lesson
↓
Example
↓
Code demonstration
↓
Practical exercise
↓
Knowledge check
↓
Summary
↓
Complete lesson
```

The online course must not simply display a giant PDF page inside the browser.

It should feel like a genuine learning platform.

---

# 39. WRITING STYLE

The book/course must be:

* practical
* technically credible
* conversational
* concise where possible
* detailed where necessary
* beginner-friendly
* professional

Avoid:

* corporate buzzwords
* excessive motivational filler
* generic AI-sounding language
* unnecessary repetition
* exaggerated claims

Write as an experienced developer teaching another developer.

---

# 40. AI TOOL POSITIONING

The course focuses primarily on:

* ChatGPT
* GitHub Copilot
* Codex

Do not make Cursor a requirement.

The book and course should teach transferable principles rather than becoming a temporary UI tutorial.

Clearly distinguish:

* AI generation
* developer review
* testing
* verification
* production responsibility

---

# 41. CODE REQUIREMENTS

All code must be:

* readable
* relevant
* internally consistent
* technically plausible
* properly formatted
* explained

Where appropriate, use:

### Before

Problematic code.

### Prompt

Developer's AI request.

### Generated Output

AI response.

### Review

What the developer should verify.

### After

Improved implementation.

This should be used particularly for:

* debugging
* refactoring
* testing
* APIs
* architecture
* code review

---

# 42. TECHNICAL EXAMPLES

Possible technologies include:

* JavaScript
* TypeScript
* React
* Node.js
* Express
* REST APIs
* PostgreSQL
* MongoDB
* SQL
* Git
* HTML/CSS

Do not turn the course into a generic React or Node course.

AI-assisted software engineering remains the central subject.

---

# 43. EXERCISE QUALITY

Exercises must have:

* objective
* context
* task
* constraints
* expected outcome
* verification criteria

Avoid exercises that merely ask:

> "Ask ChatGPT to build X."

Instead teach the learner to reason about:

* requirements
* constraints
* prompts
* generated output
* verification
* testing
* iteration

---

# 44. KNOWLEDGE CHECK QUALITY

Use:

### Conceptual questions

Test understanding.

### Practical questions

Test application.

### Troubleshooting questions

Test reasoning.

Provide explanations for correct answers.

Do not create meaningless trivia.

---

# 45. FINAL PROJECT

The course and ebook should culminate in a practical software project workflow:

```text
Idea
↓
Requirements
↓
Planning
↓
Architecture
↓
Implementation
↓
Debugging
↓
Testing
↓
Code Review
↓
Documentation
↓
Maintenance
```

AI should be used throughout the lifecycle while keeping the developer responsible for decisions and verification.

---

# 46. DIAGRAMS

Create useful diagrams for concepts such as:

* AI-assisted development lifecycle
* prompt structure
* tool selection
* debugging workflow
* project planning
* testing workflow
* code review
* final AI-powered developer workflow

Do not create decorative visuals merely to fill space.

---

# 47. EBOOK PDF PIPELINE

The PDF is a mandatory deliverable.

Do not stop after generating Markdown.

First inspect the environment for available tools.

Possible PDF pipelines:

* Typst
* Pandoc + Typst
* Pandoc + LaTeX
* HTML/CSS + WeasyPrint
* another reliable local pipeline

Prefer Typst or HTML/CSS-based rendering where available and appropriate.

Do not assume any tool is installed.

Detect the environment first.

---

# 48. PDF DESIGN

The PDF should include:

* professional cover
* title page
* section dividers
* consistent typography
* page numbers
* headers/footers
* automatic TOC
* code blocks
* tables
* callout boxes
* exercises
* diagrams
* captions
* hyperlinks
* appropriate margins
* professional spacing

The result should look like a professionally produced technical ebook.

---

# 49. PDF CODE BLOCKS

Ensure:

* no clipping
* readable monospace font
* appropriate wrapping
* syntax highlighting where practical
* sensible page breaks

Never allow code to extend outside the printable area.

---

# 50. PDF TABLES

Ensure:

* tables fit page width
* text remains readable
* headers repeat where appropriate
* no clipping
* no unreadably tiny text

Redesign oversized tables rather than shrinking them excessively.

---

# 51. PDF VISUAL QA

After generating the PDF:

1. Render PDF pages.
2. Inspect the rendered pages.
3. Identify defects.
4. Fix the source/template.
5. Regenerate the PDF.
6. Inspect again.

Look for:

* overflow
* clipping
* broken page breaks
* orphan headings
* blank pages
* missing images
* broken diagrams
* unreadable code
* table overflow
* font issues
* incorrect page numbers
* TOC problems

Do not declare the PDF complete without visual inspection.

---

# 52. PDF VALIDATION

Verify:

* PDF exists
* PDF opens
* title exists
* BrianE-Dev branding exists
* 8 sections exist
* 43 chapters exist
* TOC exists
* page numbers exist
* hyperlinks work where supported
* fonts are valid
* images are present
* no obvious truncation exists

---

# 53. COURSE RESPONSIVENESS

The React course must work across:

* desktop
* laptop
* tablet
* mobile

Do not merely shrink the desktop layout.

Adapt:

* sidebar
* curriculum navigation
* TTS player
* lesson controls
* code blocks
* assessments
* progress indicators
* buttons

for mobile interaction.

---

# 54. ACCESSIBILITY

Implement appropriate accessibility practices.

Include:

* semantic structure
* keyboard navigation
* visible focus states
* accessible buttons
* accessible labels
* sufficient contrast
* meaningful headings
* accessible form controls
* accessible assessment feedback
* TTS controls with proper labels

Do not rely solely on color to communicate state.

---

# 55. LOADING / ERROR / EMPTY STATES

Every major asynchronous feature should have appropriate states.

Include:

* loading
* success
* error
* empty
* unauthorized
* not enrolled
* unavailable

Examples:

```text
Unable to load your progress.
[Try Again]
```

Do not leave users staring at blank screens.

---

# 56. SECURITY

Protect:

* authentication tokens
* payment credentials
* TTS provider secrets
* certificate issuance
* learner progress
* private course data

Never place secret API keys in React source.

Validate data server-side.

Do not trust client-side completion claims.

---

# 57. PERFORMANCE

Avoid unnecessarily expensive architecture.

Optimize:

* lesson loading
* TTS initialization
* large code blocks
* images
* course navigation
* API requests

Do not load the entire course content unnecessarily if the course becomes large.

Use lazy loading where appropriate.

---

# 58. STATE MANAGEMENT

Use the existing project state-management approach where one exists.

Do not introduce a new global state library without justification.

Keep:

* lesson state
* TTS state
* progress state
* assessment state

well separated.

---

# 59. COMPONENT ARCHITECTURE

Create reusable components where appropriate.

Potential components:

```text
CourseHeader
CourseSidebar
CourseProgress
SectionCard
ChapterList
LessonViewer
LessonNavigation
TTSPlayer
CodeBlock
Callout
ExerciseCard
KnowledgeCheck
AssessmentResult
CompletionButton
CertificateCard
CertificateVerification
```

Do not create unnecessary component fragmentation.

---

# 60. API / CONTENT SEPARATION

Do not hard-code large amounts of course content directly inside JSX components.

Keep educational content separate from presentation.

React components should render structured content.

This makes the content reusable for:

* website
* PDF
* future mobile experience
* search
* analytics
* accessibility
* TTS

---

# 61. SEARCH / NAVIGATION

Where practical, allow learners to navigate efficiently through the curriculum.

At minimum provide:

* previous lesson
* next lesson
* current section
* current chapter
* course dashboard
* progress

Search can be added if supported by the existing application architecture, but do not make it a prerequisite for the MVP.

---

# 62. ANALYTICS

If analytics already exist, integrate course events appropriately.

Useful events include:

* course started
* lesson opened
* lesson completed
* TTS started
* exercise started
* knowledge check submitted
* course completed
* certificate issued

Do not collect unnecessary personal data.

---

# 63. CERTIFICATE DESIGN

Create a professional BrianE-Dev certificate layout.

Include:

**BrianE-Dev**

**Certificate of Completion**

Learner name

Course title

Completion date

Certificate ID

Verification information

Use appropriate branding.

Do not imply government or institutional accreditation unless explicitly supported.

---

# 64. CONTENT CONSISTENCY

The following must remain synchronized:

```text
Ebook Chapter
        ↕
Course Chapter
        ↕
Lesson
        ↕
TTS
        ↕
Exercise
        ↕
Knowledge Check
```

If a lesson is changed, identify whether the corresponding ebook and other outputs need regeneration.

---

# 65. CONTENT QA

Search the entire project for:

```text
TODO
FIXME
TBD
PLACEHOLDER
INSERT
lorem ipsum
[...]
<insert
```

No placeholders may remain in final production content.

Also check for:

* duplicated chapters
* missing chapters
* broken references
* contradictory instructions
* incomplete examples
* accidental AI commentary
* references to the generation process

---

# 66. TECHNICAL QA

Review:

* imports
* routes
* API calls
* database operations
* authentication
* authorization
* payment verification
* progress persistence
* certificate issuance
* TTS behavior
* responsive behavior

Run available:

* linting
* type checking
* unit tests
* integration tests
* build
* existing test suites

Do not falsely claim tests passed if they were not run.

---

# 67. EBOOK QA

Confirm:

* front matter
* 8 sections
* 43 chapters
* exercises
* knowledge checks
* code examples
* final project
* TOC
* references
* no placeholders

---

# 68. COURSE QA

Confirm:

* course landing page
* dashboard
* curriculum navigation
* lesson pages
* TTS
* progress tracking
* exercises
* knowledge checks
* completion
* certificate eligibility
* certificate verification
* responsive behavior
* accessibility
* authorization

---

# 69. FINAL PROJECT STRUCTURE

Adapt the repository to a maintainable structure.

A conceptual structure may look like:

```text
briane-dev/
│
├── src/
│   ├── components/
│   │   └── course/
│   ├── pages/
│   │   └── course/
│   ├── services/
│   │   └── tts/
│   ├── data/
│   └── ...
│
├── content/
│   ├── curriculum/
│   ├── lessons/
│   ├── exercises/
│   └── assessments/
│
├── ebook/
│   ├── manuscript/
│   ├── assets/
│   └── pdf/
│
├── scripts/
│   ├── build-ebook
│   ├── build-pdf
│   └── qa
│
├── final/
│   ├── COMPLETE-MANUSCRIPT.md
│   ├── TABLE-OF-CONTENTS.md
│   ├── FINAL-QA-REPORT.md
│   └── BRIANE-DEV-AI-POWERED-DEVELOPER-PRODUCTIVITY.pdf
│
└── README.md
```

Do not blindly copy this structure.

Adapt it to the existing project architecture.

---

# 70. README

Update/create README documentation explaining:

* project architecture
* curriculum source
* content model
* course implementation
* TTS implementation
* progress tracking
* assessment system
* certificate system
* ebook generation
* PDF generation
* QA commands
* required environment variables
* development commands

Do not document secrets.

---

# 71. FINAL QA REPORT

Create:

```text
final/FINAL-QA-REPORT.md
```

Include:

## Curriculum

* 8 sections
* 43 chapters
* exact order verified

## Ebook

* manuscript status
* PDF status
* visual QA
* known limitations

## Course

* pages implemented
* lessons implemented
* TTS implemented
* progress implemented
* exercises implemented
* knowledge checks implemented
* certificate system implemented

## Engineering

* build status
* tests
* lint
* database
* API
* authentication
* authorization
* payment
* security

## Final Issues

Clearly document anything unresolved.

Never claim something was verified if it wasn't.

---

# 72. DEVELOPMENT WORKFLOW

Follow the four phases and two approval checkpoints defined in Section 4. Phase 1 is read-only; stop for approval before producing the detailed Phase 2 plan. Stop again for approval before Phase 3. Implementation should be incremental and limited to the approved plan. Phase 4 validates the implemented scope and reports any unverified or unresolved items.

Possible implementation work includes curriculum-linked content modeling, course features, backend integration, payment/enrollment, ebook assembly, and PDF production. Which work is necessary must be determined from repository inspection and the approved scope; this list does not authorize it by itself.

---

# 73. DEFINITION OF DONE

The project is complete only when the approved implementation plan is fulfilled and the applicable checks below are verified. If Phase 1 finds a curriculum conflict, stop for direction before treating the curriculum criteria as achievable.

## Curriculum

```text
[ ] canonical curriculum and approved ordering verified against Section 5 and Section 6
[ ] any discrepancy resolved only with user direction
```

## Ebook

```text
[ ] front matter
[ ] complete manuscript
[ ] exercises
[ ] knowledge checks
[ ] code examples
[ ] diagrams
[ ] PDF
[ ] PDF visual QA
```

## Course

```text
[ ] approved course features implemented and validated
```

## Engineering

```text
[ ] existing architecture preserved; conditional systems implemented only when approved and needed
[ ] applicable security, responsive, accessibility, build, and test checks verified
```

## Documentation

```text
[ ] documentation and deliverables required by the approved plan are complete
```

---

# 74. CRITICAL RULES

Apply the detailed requirements in their authoritative subject sections. These cross-cutting rules summarize them:

* Preserve `src/data/curriculum.js` as the canonical source; follow Section 5 when any curriculum conflict exists.
* Keep the website in the existing React application and reuse suitable repository systems.
* Never expose secrets in frontend code. Keep security-sensitive decisions server-authoritative where a backend exists.
* TTS remains optional for reading. A PDF is required for a completed ebook and must receive visual QA.
* Do not fabricate credentials, accreditation, test results, tool capabilities, or payment confirmations. Do not claim checks that were not run.
* Avoid placeholders in final deliverables, avoid unnecessary infrastructure, preserve existing work, and document unresolved limitations.

---

# 75. FINAL RESPONSE REQUIREMENT

When the implementation is complete, provide a concise completion report containing:

1. What was implemented
2. Ebook location
3. PDF location
4. Course platform location/routes
5. TTS implementation
6. Progress implementation
7. Exercise/assessment implementation
8. Certificate implementation
9. Tests/build status
10. Any unresolved issues

Do not claim completion of any component that has not actually been implemented and verified.

---

# START NOW

Begin **PHASE 1 — REPOSITORY INSPECTION**, read-only, as defined in Section 4.

Inspect `src/data/curriculum.js` specifically and follow Section 5. Report findings in the required format, then stop and wait for approval. Do not produce the detailed implementation plan, modify files, generate the ebook, or implement anything during Phase 1.
