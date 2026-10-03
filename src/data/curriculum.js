const sectionDefinitions = [
  {
    title: 'Modern AI Developer Workflow',
    category: 'FOUNDATION',
    color: 'cyan',
    description: 'Establish mental models and practical foundations for using AI effectively as a software developer.',
    chapters: [
      'How AI Changes the Modern Developer Workflow',
      'Choosing the Right AI Tool for the Task',
      'Prompting for Better Development Results',
      'Understanding AI Strengths and Limitations',
      'Knowing When NOT to Use AI',
    ],
  },
  {
    title: 'ChatGPT for Developers',
    category: 'AI TOOL WORKFLOWS',
    color: 'green',
    description: 'Use ChatGPT throughout everyday software development work, from code understanding to technical problem solving.',
    chapters: [
      'Using ChatGPT to Understand and Explain Code',
      'Debugging Errors with ChatGPT',
      'Refactoring and Improving Existing Code',
      'Working with Frameworks, APIs, and Documentation',
      'Using ChatGPT for SQL and Database Tasks',
      'Architecture, Planning, and Technical Problem Solving',
    ],
  },
  {
    title: 'GitHub Copilot',
    category: 'AI TOOL WORKFLOWS',
    color: 'amber',
    description: 'Use GitHub Copilot as an AI coding assistant within an established software development workflow.',
    chapters: [
      'Getting Started with GitHub Copilot',
      'AI Autocomplete and Code Suggestions',
      'Generating Code with Copilot',
      'Generating and Improving Tests',
      'Refactoring with Copilot',
      'Using Copilot as an AI Pair Programmer',
    ],
  },
  {
    title: 'Codex',
    category: 'AI TOOL WORKFLOWS',
    color: 'violet',
    description: 'Use Codex for larger development tasks, codebase work, and AI-assisted engineering workflows.',
    chapters: [
      'What Codex Is and Where It Fits',
      'Generating and Editing Code with Codex',
      'Making Multi-File Changes',
      'Asking Codex to Explain Existing Code',
      'Using Codex for Larger Development Tasks',
      'ChatGPT vs GitHub Copilot vs Codex',
    ],
  },
  {
    title: 'Building a Full Project with AI',
    category: 'PROJECT WORKFLOW',
    color: 'cyan',
    description: 'Apply AI productivity methods to a realistic project from planning through implementation, review, and delivery.',
    chapters: [
      'Planning the Project with ChatGPT',
      'Defining Requirements and Technical Specifications',
      'Designing the Project Architecture',
      'Breaking the Project into Development Tasks',
      'Implementing Features with AI Assistance',
      'Reviewing and Refining AI-Generated Code',
      'Debugging and Improving the Application',
      'Preparing the Project for Delivery',
    ],
  },
  {
    title: 'Debugging with AI',
    category: 'DEVELOPMENT WORKFLOW',
    color: 'amber',
    description: 'Investigate, understand, and resolve software problems with a systematic AI-assisted workflow.',
    chapters: [
      'Understanding Errors and Stack Traces',
      'Giving AI the Right Debugging Context',
      'Investigating Bugs Systematically',
      'Verifying AI-Suggested Fixes',
    ],
  },
  {
    title: 'Documentation & Testing',
    category: 'DEVELOPMENT WORKFLOW',
    color: 'green',
    description: 'Use AI to reduce the time and effort involved in writing, improving, and reviewing documentation and tests.',
    chapters: [
      'Using AI to Write and Improve Documentation',
      'Using AI to Generate and Improve Tests',
      'Reviewing Documentation and Tests with AI',
    ],
  },
  {
    title: 'Security & Best Practices',
    category: 'RESPONSIBLE AI USE',
    color: 'violet',
    description: 'Use AI responsibly while protecting code, data, credentials, and software quality.',
    chapters: [
      'Protecting Sensitive Information When Using AI',
      'Reviewing AI-Generated Code for Security Risks',
      'Avoiding Blind Trust in AI Output',
      'Verifying and Validating AI-Generated Work',
      'Building a Responsible AI-Assisted Development Workflow',
    ],
  },
]

let nextChapterNumber = 1

export const curriculum = {
  title: 'AI-Powered Developer Productivity for Software Engineers',
  description: 'Learn to use AI effectively throughout the software development lifecycle to improve productivity, reasoning, debugging, planning, refactoring, documentation, testing, and everyday engineering workflows. Code provides the working context for lessons, examples, demonstrations, and workflows.',
  sections: sectionDefinitions.map((section, sectionIndex) => ({
    ...section,
    number: String(sectionIndex + 1).padStart(2, '0'),
    chapters: section.chapters.map((title) => ({
      number: String(nextChapterNumber++).padStart(2, '0'),
      title,
    })),
  })),
  formats: [
    { title: 'Written lessons', description: 'Read structured instruction about using AI throughout software development.' },
    { title: 'Code examples', description: 'Study code in context as part of AI-assisted development workflows.' },
    { title: 'Real-world development scenarios', description: 'Consider practical situations drawn from everyday software work.' },
    { title: 'AI prompts and workflows', description: 'Review approaches for using AI to support development tasks.' },
    { title: 'Explanations', description: 'Understand the reasoning behind tools, decisions, and AI-assisted approaches.' },
    { title: 'Practical demonstrations', description: 'Follow demonstrations of AI use in software development contexts.' },
    { title: 'TTS audio narration', description: 'Listen to lesson content while reviewing developer workflows.' },
  ],
}

export const totalChapters = curriculum.sections.reduce((total, section) => total + section.chapters.length, 0)
