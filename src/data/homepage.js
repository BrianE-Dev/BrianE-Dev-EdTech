import { totalChapters } from './curriculum.js'

export const questions = [
  ['What is this course about?', 'AI-powered developer productivity. Learn to use AI across planning, code understanding, debugging, refactoring, documentation, testing, architecture, and delivery.'],
  ['Who is this course for?', 'Software developers who want to use AI more effectively throughout their development work.'],
  ['Does this teach programming from scratch?', 'No. Code is the working context for lessons and examples; the course focuses on using AI to improve developer productivity.'],
  ['What learning materials are included?', 'Written lessons, code examples, real-world development scenarios, AI prompts and workflows, explanations, practical demonstrations, and TTS audio narration.'],
]

export const plans = [
  { id: 'individual', label: 'INDIVIDUAL COURSE ACCESS', name: 'Individual Course Pass', period: 'one-time', desc: 'Unlock all 43 lessons and the complete course materials.', features: ['All 43 written lessons and code examples', 'Lesson assessments and required activities', 'Saved progress across the full curriculum', 'Certificate eligibility after all course requirements are met', 'Downloadable course ebook', 'Optional browser speech synthesis'], action: 'Enroll Now', popular: true },
  { id: 'team', label: 'TEAM COURSE ACCESS', name: 'Engineering Team Course', price: '$1,490', period: 'per team / year', desc: 'AI-powered developer productivity learning for engineering teams.', features: [`Course content across all ${totalChapters} chapters`, 'Written lessons and code examples', 'Real-world scenarios, AI prompts, and workflows', 'TTS audio narration'], action: 'Explore Team Plans' },
]

export const courseFormats = [
  { title: 'WRITTEN LESSONS', description: 'Read structured, technical instruction that breaks down AI-assisted development workflows step by step.' },
  { title: 'CODE EXAMPLES', description: 'Study real code in context and see how AI can support understanding, implementation, debugging, refactoring, and technical problem solving.' },
  { title: 'DEVELOPMENT SCENARIOS', description: 'Work through realistic software engineering situations that connect AI techniques to the decisions developers make every day.' },
  { title: 'AI PROMPTS & WORKFLOWS', description: 'Study practical approaches for giving AI the right context, structuring requests, reviewing output, and incorporating AI into your development process.' },
]

export const features = [
  { icon: 'book', tone: 'cyan', title: 'Written Lessons & Code Examples', description: 'Technical concepts explained clearly through practical software scenarios, code examples, prompts, and developer workflows.', footer: 'READ AT YOUR PACE' },
  { icon: 'grid', tone: 'green', title: 'AI-Assisted Workflows', description: 'Learn how to use AI across the software lifecycle—from planning and implementation to debugging, refactoring, testing, documentation, and technical problem solving.', footer: 'WORK SMARTER' },
  { icon: 'headphones', tone: 'amber', title: 'Audio Narration', description: 'Listen to lessons when you want an alternative to reading. Use narration to review technical concepts and workflows while keeping the full written lesson available for deeper study.', footer: 'LEARN YOUR WAY' },
]
