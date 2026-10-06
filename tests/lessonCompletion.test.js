import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/data/curriculum.js'
import { acknowledgeRequiredExercise, evaluateLessonCompletion, getCourseProgress, openLessonProgress, updateLessonProgress } from '../backend/src/services/lessonCompletion.js'
import { submitLessonAssessment } from '../backend/src/services/assessmentService.js'

const chapter = curriculum.sections[0].chapters[0]
const course = { id: 'course-id', certificateEligible: true, title: 'Course' }
const user = { id: 'user-id', name: 'Learner' }
const lesson = {
  chapterId: chapter.id,
  contentVersion: '1.0.0',
  exercises: [{ id: 'exercise-required', required: true }],
  assessments: [{
    id: 'assessment-required',
    required: true,
    passThreshold: 0.7,
    correctOptionId: 'option-correct',
    options: [{ id: 'option-correct' }, { id: 'option-wrong' }],
  }],
}

function progressModel(initial = null) {
  let stored = initial ? { ...initial, save: async function save() { return this } } : null
  return {
    async findOne() { return stored },
    async create(value) { stored = { ...value, save: async function save() { return this } }; return stored },
    async updateOne(filter, update) {
      if (!stored) return { matchedCount: 0 }
      const chapterFilter = filter['chapterProgress.chapterId']
      const chapterId = chapterFilter?.$ne || chapterFilter
      const exists = (stored.chapterProgress || []).some((item) => item.chapterId === chapterId)
      if (chapterFilter?.$ne && exists) return { matchedCount: 0 }
      if (update.$push?.chapterProgress) {
        stored.chapterProgress ||= []
        stored.chapterProgress.push({ ...update.$push.chapterProgress })
      }
      if (update.$set?.currentChapterId) stored.currentChapterId = update.$set.currentChapterId
      return { matchedCount: 1 }
    },
    get() { return stored },
  }
}

function progressSnapshot(progress) {
  return {
    ...progress,
    chapterProgress: (progress.chapterProgress || []).map((item) => ({ ...item })),
    save: async function save() { return this },
  }
}

function assessmentModel() {
  const attempts = []
  return {
    attempts,
    async countDocuments(filter) { return attempts.filter((item) => item.user === filter.user && item.course === filter.course && item.chapterId === filter.chapterId && item.assessmentId === filter.assessmentId).length },
    async create(value) { const attempt = { ...value, _id: `attempt-${attempts.length + 1}` }; attempts.push(attempt); return attempt },
    async exists(filter) { return attempts.some((item) => item.user === filter.user && item.course === filter.course && item.chapterId === filter.chapterId && item.assessmentId === filter.assessmentId && item.passed === filter.passed) },
  }
}

test('stable progress does not map legacy index completion and enforces required activities', async () => {
  const ProgressModel = progressModel()
  const AssessmentAttemptModel = assessmentModel()
  let certificateWrites = 0
  const CertificateModel = { async findOneAndUpdate() { certificateWrites += 1; return { certificateId: 'unexpected' } } }
  const legacyProgress = { completedChapters: ['1'], completionPercentage: 100 }
  const summary = await getCourseProgress({ user, course, ProgressModel: { findOne: async () => legacyProgress } })
  assert.equal(summary.completionPercentage, 0)
  assert.equal(summary.chapters[0].status, 'not_started')

  await openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel })
  await assert.rejects(
    updateLessonProgress({ user, course, lesson, status: 'completed', ProgressModel, AssessmentAttemptModel, CertificateModel }),
    (error) => error.name === 'CompletionRequirementsError' && error.unmet.unmetAssessments[0] === 'assessment-required' && error.unmet.unmetExercises[0] === 'exercise-required',
  )
  const result = await acknowledgeRequiredExercise({ user, course, lesson, exerciseId: 'exercise-required', ProgressModel, AssessmentAttemptModel, CertificateModel })
  assert.equal(result.progress.chapterProgress[0].status, 'in_progress')
  assert.deepEqual(result.progress.chapterProgress[0].requiredExerciseAcknowledgments, ['exercise-required'])
  assert.equal(certificateWrites, 0)
})

test('assessments persist each retry without answer keys and complete after requirements pass', async () => {
  const ProgressModel = progressModel()
  const AssessmentAttemptModel = assessmentModel()
  const CertificateModel = { async findOneAndUpdate() { return { certificateId: 'BE-test' } } }
  await openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel })
  await acknowledgeRequiredExercise({ user, course, lesson, exerciseId: 'exercise-required', ProgressModel, AssessmentAttemptModel, CertificateModel })
  const completionDependencies = { ProgressModel, CertificateModel }
  const first = await submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-wrong' }] },
    AssessmentAttemptModel, completionDependencies,
  })
  assert.equal(first.assessment.passed, false)
  assert.equal(first.assessment.attemptNumber, 1)
  const second = await submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-correct' }] },
    AssessmentAttemptModel, completionDependencies,
  })
  assert.equal(second.assessment.passed, true)
  assert.equal(second.assessment.attemptNumber, 2)
  assert.equal(second.progress.chapterProgress[0].status, 'completed')
  assert.equal(second.completion.courseCompleted, false)
  assert.equal(AssessmentAttemptModel.attempts.length, 2)
  assert.equal('correctOptionId' in AssessmentAttemptModel.attempts[1], false)

  const requirements = await evaluateLessonCompletion({ user, course, lesson, progress: ProgressModel.get(), AssessmentAttemptModel })
  assert.equal(requirements.canComplete, true)
})

test('passing assessment waits for exercise acknowledgment, then exercise completion is stable across lesson opens', async () => {
  const ProgressModel = progressModel()
  const AssessmentAttemptModel = assessmentModel()
  let certificateWrites = 0
  const CertificateModel = { async findOneAndUpdate() { certificateWrites += 1; return { certificateId: 'BE-test' } } }
  const completionDependencies = { ProgressModel, CertificateModel }

  const assessment = await submitLessonAssessment({
    user, course, lesson,
    body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-correct' }] },
    AssessmentAttemptModel, completionDependencies,
  })
  assert.equal(assessment.assessment.passed, true)
  assert.equal(assessment.progress, null)
  assert.equal(ProgressModel.get().chapterProgress[0].status, 'in_progress')
  assert.deepEqual(ProgressModel.get().chapterProgress[0].requiredExerciseAcknowledgments, [])

  const completed = await acknowledgeRequiredExercise({
    user, course, lesson, exerciseId: 'exercise-required',
    ProgressModel, AssessmentAttemptModel, CertificateModel,
  })
  assert.equal(completed.progress.chapterProgress[0].status, 'completed')
  assert.ok(completed.progress.chapterProgress[0].completedAt instanceof Date)
  assert.deepEqual(completed.progress.chapterProgress[0].requiredExerciseAcknowledgments, ['exercise-required'])
  assert.equal(completed.progress.canonicalCompletionPercentage, 2.33)
  assert.equal(certificateWrites, 0)

  const reopened = await openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel })
  assert.equal(reopened.chapterProgress.length, 1)
  assert.equal(reopened.chapterProgress[0].status, 'completed')
  assert.deepEqual(reopened.chapterProgress[0].requiredExerciseAcknowledgments, ['exercise-required'])

  const anotherChapterLesson = { chapterId: curriculum.sections[0].chapters[1].id, exercises: [], assessments: [] }
  const unknownExercise = await acknowledgeRequiredExercise({
    user, course, lesson: anotherChapterLesson, exerciseId: 'exercise-required',
    ProgressModel, AssessmentAttemptModel, CertificateModel,
  })
  assert.equal(unknownExercise.found, false)
  assert.equal(reopened.chapterProgress.length, 1)
})

test('concurrent same-chapter opens atomically create one valid progress entry', async () => {
  const stored = { user: user.id, course: course.id, chapterProgress: [] }
  let atomicUpdates = 0
  let insertions = 0
  let existingChapterUpdates = 0
  const ProgressModel = {
    async findOne() { return progressSnapshot(stored) },
    async create(value) { Object.assign(stored, value); return progressSnapshot(stored) },
    async updateOne(filter, update) {
      atomicUpdates += 1
      const chapterCondition = filter['chapterProgress.chapterId']
      const chapterId = chapterCondition?.$ne || chapterCondition
      const exists = stored.chapterProgress.some((item) => item.chapterId === chapterId)
      if (chapterCondition?.$ne && exists) return { matchedCount: 0 }
      if (!chapterCondition?.$ne && !exists) return { matchedCount: 0 }
      if (update.$push?.chapterProgress) {
        insertions += 1
        stored.chapterProgress.push({ ...update.$push.chapterProgress })
      } else existingChapterUpdates += 1
      stored.currentChapterId = update.$set.currentChapterId
      return { matchedCount: 1 }
    },
  }

  const opened = await Promise.all(Array.from({ length: 20 }, () =>
    openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel }),
  ))
  assert.equal(opened.length, 20)
  assert.equal(atomicUpdates, 39)
  assert.equal(insertions, 1)
  assert.equal(existingChapterUpdates, 19)
  assert.equal(stored.chapterProgress.length, 1)
  assert.equal(new Set(stored.chapterProgress.map((item) => item.chapterId)).size, 1)
  assert.equal(stored.chapterProgress[0].chapterId, chapter.id)
  assert.equal(stored.chapterProgress[0].status, 'in_progress')
  assert.ok(stored.chapterProgress[0].startedAt instanceof Date)
})

test('concurrent opens for different chapters retain each atomic insertion', async () => {
  const stored = { user: user.id, course: course.id, chapterProgress: [] }
  const ProgressModel = {
    async findOne() { return progressSnapshot(stored) },
    async create(value) { Object.assign(stored, value); return progressSnapshot(stored) },
    async updateOne(filter, update) {
      const chapterCondition = filter['chapterProgress.chapterId']
      const chapterId = chapterCondition?.$ne || chapterCondition
      const exists = stored.chapterProgress.some((item) => item.chapterId === chapterId)
      if (chapterCondition?.$ne && exists) return { matchedCount: 0 }
      if (!chapterCondition?.$ne && !exists) return { matchedCount: 0 }
      if (update.$push?.chapterProgress) stored.chapterProgress.push({ ...update.$push.chapterProgress })
      stored.currentChapterId = update.$set.currentChapterId
      return { matchedCount: 1 }
    },
  }
  const requested = curriculum.sections.flatMap((section) => section.chapters).slice(0, 12).map((item) => item.id)

  await Promise.all(requested.map((chapterId) => openLessonProgress({ user, course, chapterId, ProgressModel })))

  assert.equal(stored.chapterProgress.length, requested.length)
  assert.deepEqual(new Set(stored.chapterProgress.map((item) => item.chapterId)), new Set(requested))
  assert.equal(new Set(stored.chapterProgress.map((item) => item.chapterId)).size, requested.length)
})

test('concurrent opens preserve completed chapter state and timestamp', async () => {
  const completedAt = new Date('2026-01-02T03:04:05.000Z')
  const stored = {
    user: user.id,
    course: course.id,
    chapterProgress: [{
      chapterId: chapter.id,
      status: 'completed',
      startedAt: new Date('2026-01-01T01:00:00.000Z'),
      completedAt,
      requiredExerciseAcknowledgments: ['exercise-required'],
    }],
    canonicalCompletionPercentage: 2.33,
  }
  const ProgressModel = {
    async findOne() { return progressSnapshot(stored) },
    async create(value) { Object.assign(stored, value); return progressSnapshot(stored) },
    async updateOne(filter, update) {
      if (filter['chapterProgress.chapterId'].$ne === chapter.id) return { matchedCount: 0 }
      stored.currentChapterId = update.$set.currentChapterId
      return { matchedCount: 1 }
    },
  }

  await Promise.all(Array.from({ length: 10 }, () =>
    openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel }),
  ))

  assert.equal(stored.chapterProgress.length, 1)
  assert.equal(stored.chapterProgress[0].status, 'completed')
  assert.equal(stored.chapterProgress[0].completedAt.getTime(), completedAt.getTime())
  assert.deepEqual(stored.chapterProgress[0].requiredExerciseAcknowledgments, ['exercise-required'])
  assert.equal(stored.canonicalCompletionPercentage, 2.33)
  assert.equal((await getCourseProgress({ user, course, ProgressModel })).completionPercentage, 2.33)
})

test('a later failed retry does not erase an earlier passing assessment', async () => {
  const ProgressModel = progressModel()
  const AssessmentAttemptModel = assessmentModel()
  const CertificateModel = { async findOneAndUpdate() { return { certificateId: 'BE-test' } } }
  await openLessonProgress({ user, course, chapterId: chapter.id, ProgressModel })
  await acknowledgeRequiredExercise({ user, course, lesson, exerciseId: 'exercise-required', ProgressModel, AssessmentAttemptModel, CertificateModel })

  const dependencies = { AssessmentAttemptModel, completionDependencies: { ProgressModel, CertificateModel } }
  const passing = await submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-correct' }] }, ...dependencies,
  })
  assert.equal(passing.progress.chapterProgress[0].status, 'completed')

  const laterFailure = await submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-wrong' }] }, ...dependencies,
  })
  assert.equal(laterFailure.assessment.passed, false)
  assert.equal(laterFailure.assessment.attemptNumber, 2)
  assert.equal(laterFailure.progress, null)
  const requirements = await evaluateLessonCompletion({ user, course, lesson, progress: ProgressModel.get(), AssessmentAttemptModel })
  assert.equal(requirements.canComplete, true)
  assert.equal(ProgressModel.get().chapterProgress[0].status, 'completed')
})

test('assessment rejects unknown question and option identifiers', async () => {
  const AssessmentAttemptModel = assessmentModel()
  await assert.rejects(submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: 'unknown', optionId: 'option-wrong' }] }, AssessmentAttemptModel,
  }), /question was not found/)
  await assert.rejects(submitLessonAssessment({
    user, course, lesson, body: { answers: [{ questionId: lesson.assessments[0].id, optionId: 'unknown' }] }, AssessmentAttemptModel,
  }), /option is not valid/)
  await assert.rejects(submitLessonAssessment({
    user, course, lesson, body: { score: 1, passed: true, completed: true, completedAt: new Date(), answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-correct' }] }, AssessmentAttemptModel,
  }), /malformed/)
  assert.equal(AssessmentAttemptModel.attempts.length, 0)
})

test('chapters with no required activities complete through the server progress action', async () => {
  const ProgressModel = progressModel()
  const noRequirements = { chapterId: chapter.id, exercises: [], assessments: [] }
  const result = await updateLessonProgress({ user, course, lesson: noRequirements, status: 'completed', ProgressModel })
  assert.equal(result.progress.chapterProgress[0].status, 'completed')
  assert.ok(result.progress.chapterProgress[0].completedAt instanceof Date)
  assert.equal(result.progress.canonicalCompletionPercentage, 2.33)

  const repeated = await updateLessonProgress({ user, course, lesson: noRequirements, status: 'in_progress', ProgressModel })
  assert.equal(repeated.progress.chapterProgress[0].status, 'completed')
  assert.equal(repeated.progress.chapterProgress[0].completedAt.getTime(), result.progress.chapterProgress[0].completedAt.getTime())
})

test('certificate is withheld at 42 of 43 and issued once at canonical 43 of 43', async () => {
  const allChapters = curriculum.sections.flatMap((section) => section.chapters)
  const progressRecord = {
    user: user.id,
    course: course.id,
    chapterProgress: allChapters.slice(0, -1).map((item) => ({ chapterId: item.id, status: 'completed', startedAt: new Date(), completedAt: new Date(), requiredExerciseAcknowledgments: [] })),
  }
  const ProgressModel = progressModel(progressRecord)
  let upserts = 0
  const certificates = new Map()
  const CertificateModel = {
    async findOneAndUpdate(filter, update) {
      upserts += 1
      const key = `${filter.user}:${filter.course}`
      if (!certificates.has(key)) certificates.set(key, { certificateId: update.$setOnInsert.certificateId })
      return certificates.get(key)
    },
  }
  const finalLesson = { chapterId: allChapters.at(-1).id, exercises: [], assessments: [] }
  const notYetComplete = await updateLessonProgress({ user, course, lesson: finalLesson, status: 'in_progress', ProgressModel, CertificateModel })
  assert.equal(notYetComplete.courseCompleted, false)
  assert.equal(upserts, 0)

  const complete = await updateLessonProgress({ user, course, lesson: finalLesson, status: 'completed', ProgressModel, CertificateModel })
  assert.equal(complete.courseCompleted, true)
  assert.ok(complete.certificate.certificateId)
  assert.equal(upserts, 1)
  const repeated = await updateLessonProgress({ user, course, lesson: finalLesson, status: 'completed', ProgressModel, CertificateModel })
  assert.equal(repeated.courseCompleted, true)
  assert.equal(upserts, 1)
})

test('certificate is withheld when canonical completion is zero', async () => {
  const ProgressModel = progressModel()
  let upserts = 0
  const CertificateModel = { async findOneAndUpdate() { upserts += 1; return { certificateId: 'unexpected' } } }
  const firstLesson = { chapterId: curriculum.sections[0].chapters[0].id, exercises: [], assessments: [] }
  const result = await updateLessonProgress({
    user, course, lesson: firstLesson, status: 'in_progress', ProgressModel, CertificateModel,
  })
  assert.equal(result.progress.canonicalCompletionPercentage, 0)
  assert.equal(result.courseCompleted, false)
  assert.equal(result.certificateIssued, false)
  assert.equal(upserts, 0)
})

test('certificate eligibility and legacy-only progress do not create a certificate', async () => {
  const allChapters = curriculum.sections.flatMap((section) => section.chapters)
  const legacyOnly = { completedChapters: allChapters.map((item) => item.id), completionPercentage: 100, chapterProgress: [] }
  const summary = await getCourseProgress({ user, course, ProgressModel: { findOne: async () => legacyOnly } })
  assert.equal(summary.completionPercentage, 0)
  assert.equal(summary.completedChapters, 0)

  const ProgressModel = progressModel({ chapterProgress: allChapters.slice(0, -1).map((item) => ({ chapterId: item.id, status: 'completed' })) })
  let upserts = 0
  const CertificateModel = { async findOneAndUpdate() { upserts += 1; return { certificateId: 'unexpected' } } }
  const ineligibleCourse = { ...course, certificateEligible: false }
  const result = await updateLessonProgress({
    user, course: ineligibleCourse, lesson: { chapterId: allChapters.at(-1).id, exercises: [], assessments: [] },
    status: 'completed', ProgressModel, CertificateModel,
  })
  assert.equal(result.courseCompleted, true)
  assert.equal(result.certificateIssued, false)
  assert.equal(upserts, 0)
})

test('assessment attempt numbering retries unique conflicts and fails safely when exhausted', async () => {
  const uniqueAttempts = assessmentModel()
  const firstCreate = uniqueAttempts.create
  let initialCounts = 0
  uniqueAttempts.countDocuments = async () => initialCounts++ < 2 ? 0 : uniqueAttempts.attempts.length
  uniqueAttempts.create = async (value) => {
    if (uniqueAttempts.attempts.some((item) => item.attemptNumber === value.attemptNumber)) {
      throw Object.assign(new Error('Duplicate key'), { code: 11000 })
    }
    return firstCreate(value)
  }
  const submission = { answers: [{ questionId: lesson.assessments[0].id, optionId: 'option-wrong' }] }
  const concurrent = await Promise.all([
    submitLessonAssessment({ user, course, lesson, body: submission, AssessmentAttemptModel: uniqueAttempts }),
    submitLessonAssessment({ user, course, lesson, body: submission, AssessmentAttemptModel: uniqueAttempts }),
  ])
  assert.deepEqual(concurrent.map((item) => item.assessment.attemptNumber).sort(), [1, 2])
  assert.equal(uniqueAttempts.attempts.length, 2)
  assert.equal('correctOptionId' in uniqueAttempts.attempts[0], false)

  const exhausted = {
    async countDocuments() { return 0 },
    async create() { throw Object.assign(new Error('Duplicate key'), { code: 11000 }) },
  }
  await assert.rejects(submitLessonAssessment({ user, course, lesson, body: submission, AssessmentAttemptModel: exhausted }), /Duplicate key/)
})
