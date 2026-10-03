# BrianE-Dev Documentation

## Product overview

BrianE-Dev is a React learning application for **AI-powered developer productivity for software engineers**. Its course teaches software developers to use AI effectively throughout the software development lifecycle, including reasoning, planning, code understanding, debugging, refactoring, documentation, testing, architecture, and delivery.

The course is about using AI to improve software development work, not learning programming from scratch. Code is the working context for lessons, examples, demonstrations, and workflows. Learners study the material and apply it in their own development workflows.

## Approved course

**AI-Powered Developer Productivity for Software Engineers**

The authoritative course data is [`src/data/curriculum.js`](src/data/curriculum.js). It contains the course title and description, all approved sections and chapters, and the learning formats. Section numbers, globally sequential chapter numbers, and the total chapter count are generated from this data. The course has **8 sections and 43 chapters**.

Update `src/data/curriculum.js` when approved course content changes. Do not maintain a separate curriculum list or count in a page or component. The homepage section cards, expandable chapter lists, course-format cards, chapter counts in access plans, browser title, and meta description consume this source.

### Section 01 — Modern AI Developer Workflow (5 chapters)

Purpose: Establish the mental models and practical foundations for using AI effectively as a software developer.

1. How AI Changes the Modern Developer Workflow
2. Choosing the Right AI Tool for the Task
3. Prompting for Better Development Results
4. Understanding AI Strengths and Limitations
5. Knowing When NOT to Use AI

### Section 02 — ChatGPT for Developers (6 chapters)

Purpose: Teach practical ways developers can use ChatGPT throughout everyday software development work.

1. Using ChatGPT to Understand and Explain Code
2. Debugging Errors with ChatGPT
3. Refactoring and Improving Existing Code
4. Working with Frameworks, APIs, and Documentation
5. Using ChatGPT for SQL and Database Tasks
6. Architecture, Planning, and Technical Problem Solving

### Section 03 — GitHub Copilot (6 chapters)

Purpose: Teach developers how to use GitHub Copilot as an AI coding assistant inside their development workflow.

1. Getting Started with GitHub Copilot
2. AI Autocomplete and Code Suggestions
3. Generating Code with Copilot
4. Generating and Improving Tests
5. Refactoring with Copilot
6. Using Copilot as an AI Pair Programmer

### Section 04 — Codex (6 chapters)

Purpose: Teach developers how to use Codex for larger development tasks, codebase work, and AI-assisted engineering workflows.

1. What Codex Is and Where It Fits
2. Generating and Editing Code with Codex
3. Making Multi-File Changes
4. Asking Codex to Explain Existing Code
5. Using Codex for Larger Development Tasks
6. ChatGPT vs GitHub Copilot vs Codex

### Section 05 — Building a Full Project with AI (8 chapters)

Purpose: Apply AI productivity methods to a realistic project from planning through implementation and verification.

1. Planning the Project with ChatGPT
2. Defining Requirements and Technical Specifications
3. Designing the Project Architecture
4. Breaking the Project into Development Tasks
5. Implementing Features with AI Assistance
6. Reviewing and Refining AI-Generated Code
7. Debugging and Improving the Application
8. Preparing the Project for Delivery

### Section 06 — Debugging with AI (4 chapters)

Purpose: Develop a systematic workflow for using AI to investigate, understand, and resolve software problems.

1. Understanding Errors and Stack Traces
2. Giving AI the Right Debugging Context
3. Investigating Bugs Systematically
4. Verifying AI-Suggested Fixes

### Section 07 — Documentation & Testing (3 chapters)

Purpose: Show how AI can reduce the time and effort required for documentation and software testing.

1. Using AI to Write and Improve Documentation
2. Using AI to Generate and Improve Tests
3. Reviewing Documentation and Tests with AI

### Section 08 — Security & Best Practices (5 chapters)

Purpose: Teach responsible and effective AI usage while protecting code, data, credentials, and software quality.

1. Protecting Sensitive Information When Using AI
2. Reviewing AI-Generated Code for Security Risks
3. Avoiding Blind Trust in AI Output
4. Verifying and Validating AI-Generated Work
5. Building a Responsible AI-Assisted Development Workflow

**Total: 8 sections, 43 chapters.** Chapter numbers shown in the application are sequential across the complete course.

## Course content format

The approved course formats are written lessons, code examples, real-world development scenarios, AI prompts and workflows, explanations, practical demonstrations, and TTS audio narration.

The application does not currently provide interactive coding sandboxes, browser coding playgrounds, automated coding challenges, lesson checkpoints, quizzes, in-platform coding assignments, or automated skill assessments. Avoid describing these as product features unless they are implemented in a future version.

## Current application

The current frontend is a responsive React 19 application built with Vite. It contains a homepage with:

- Hero section and product positioning
- Feature cards for written lessons and code examples, AI-powered workflows, and TTS narration
- Eight expandable curriculum cards with chapter titles
- Course-format overview
- Access-plan cards, FAQs, and navigation anchors
- Light and dark themes; the saved preference is stored in local storage, with the operating-system theme used on first visit
- A hero entrance animation that replays when the hero re-enters the viewport and respects reduced-motion preferences

This repository currently has no separate course, section, or lesson routes; course navigation beyond the homepage; student dashboard; admin interface; progress tracking; backend API; database; or seed data. The app's chapter list is a curriculum overview, not a lesson player or progress system.

The files in `UI From Stitch/` are design references. Older curriculum descriptions and mock interface elements in those references are not authoritative product content. Use `src/data/curriculum.js` for approved course information.

## Project structure

```text
.
├── public/                 # Static public assets, including favicon and SVG symbols
├── src/
│   ├── components/         # Shared React UI components
│   ├── data/
│   │   ├── curriculum.js   # Single source of truth for title, sections, chapters, and formats
│   │   └── homepage.js     # Homepage features, FAQs, and access-plan descriptions
│   ├── App.jsx             # Homepage composition and interactions
│   ├── App.css             # Component and responsive styles
│   ├── index.css            # Global styles and theme tokens
│   └── main.jsx             # React application entry point
├── UI From Stitch/         # Supplied design references and imagery
├── documentation.md
├── index.html
├── package.json
└── vite.config.js
```

Shared UI components include `Brand`, `Icon`, `SectionHeading`, `FeatureCard`, `CurriculumCard`, `PricingCard`, and `FaqList` in `src/components/`.

## Development

Requirements: Node.js and npm compatible with the versions declared by the project dependencies.

Install dependencies in the project root:

```sh
npm install
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create the production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |

Direct runtime dependencies are React, React DOM, and Lucide React. Vite, the React plugin, and ESLint are development dependencies.
