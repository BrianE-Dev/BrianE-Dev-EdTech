import { totalChapters } from './curriculum.js'

export const questions = [
  ['What is this course about?', 'AI-powered developer productivity. Learn to use AI across planning, code understanding, debugging, refactoring, documentation, testing, architecture, and delivery.'],
  ['Who is this course for?', 'Software developers who want to use AI more effectively throughout their development work.'],
  ['Does this teach programming from scratch?', 'No. Code is the working context for lessons and examples; the course focuses on using AI to improve developer productivity.'],
  ['What learning materials are included?', 'Written lessons, code examples, real-world development scenarios, AI prompts and workflows, explanations, practical demonstrations, and TTS audio narration.'],
]

export const plans = [
  { id: 'individual', label: 'INDIVIDUAL COURSE ACCESS', name: 'Individual Course Pass', price: '$249', period: 'one-time', desc: 'Unlock the complete Chapter 1 lesson and published course materials. The other 42 chapter lessons are still being authored.', features: ['Complete Chapter 1 lesson', 'Assessments and exercises for published lessons', 'Saved progress against the approved curriculum', 'Certificate eligibility after all course requirements are met', 'Course ebook download when the PDF is published', 'Optional browser speech synthesis for authored lessons'], action: 'Enroll Now', popular: true },
  { id: 'team', label: 'TEAM COURSE ACCESS', name: 'Engineering Team Course', price: '$1,490', period: 'per team / year', desc: 'AI-powered developer productivity learning for engineering teams.', features: [`Course content across all ${totalChapters} chapters`, 'Written lessons and code examples', 'Real-world scenarios, AI prompts, and workflows', 'TTS audio narration'], action: 'Explore Team Plans' },
]

export const features = [
  { icon: 'book', tone: 'cyan', title: 'Written Lessons & Code Examples', description: 'Clear, deliberate explanations with real-world examples, prompts, workflows, and working code patterns.', footer: 'READ AT YOUR PACE' },
  { icon: 'grid', tone: 'green', title: 'AI-Powered Workflows', description: 'Learn practical ways to use AI across planning, debugging, refactoring, documentation, testing, and other stages of the software lifecycle.', footer: 'WORK SMARTER' },
  { icon: 'headphones', tone: 'amber', title: 'TTS Audio Narration', description: 'Listen to lessons and stay in flow while reviewing technical concepts, workflows, and AI-assisted development practices.', footer: 'LEARN YOUR WAY' },
]
