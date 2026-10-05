export const validLessonFixture = {
  schemaVersion: '1.0.0',
  contentVersion: '1.0.0',
  chapterId: 'chapter-ai-assisted-developer',
  title: 'The AI-Assisted Developer',
  objectives: [],
  blocks: [
    { type: 'heading', level: 2, text: 'Test heading' },
    { type: 'paragraph', text: 'Schema fixture text.' },
  ],
  ttsText: null,
  exercises: [],
  assessments: [],
}

export const validAssessmentFixture = {
  id: 'assessment-chapter-ai-assisted-developer-01',
  type: 'multiple-choice',
  prompt: 'Which option is correct?',
  options: [
    { id: 'option-a', text: 'First option' },
    { id: 'option-b', text: 'Second option' },
  ],
  correctOptionId: 'option-b',
  explanation: 'This is a structural schema fixture.',
  required: false,
  passThreshold: 0.7,
}
