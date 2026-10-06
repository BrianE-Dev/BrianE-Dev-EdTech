import crypto from 'node:crypto'
import { AssessmentAttempt, Certificate, Progress } from '../models/index.js'
import { curriculum } from '../../../src/data/curriculum.js'

export class CompletionRequirementsError extends Error {
  constructor(unmet) {
    super('Lesson completion requirements are not met.')
    this.name = 'CompletionRequirementsError'
    this.unmet = unmet
  }
}

function chapterById(chapterId) {
  return curriculum.sections.flatMap((section) => section.chapters).find((chapter) => chapter.id === chapterId)
}

function chapterState(progress, chapterId) {
  return progress.chapterProgress?.find((item) => item.chapterId === chapterId)
}

async function getOrCreateProgress(user, course, ProgressModel) {
  const userId = user.id || user._id
  let progress = await ProgressModel.findOne({ user: userId, course: course.id || course._id })
  if (progress) return progress
  try {
    return await ProgressModel.create({ user: userId, course: course.id || course._id, chapterProgress: [] })
  } catch (error) {
    if (error.code !== 11000) throw error
    progress = await ProgressModel.findOne({ user: userId, course: course.id || course._id })
    if (!progress) throw error
    return progress
  }
}

async function ensureStartedChapter({ user, course, chapterId, ProgressModel, now }) {
  const userId = user.id || user._id
  const courseId = course.id || course._id
  await getOrCreateProgress(user, course, ProgressModel)

  const absentFilter = {
    user: userId,
    course: courseId,
    'chapterProgress.chapterId': { $ne: chapterId },
  }
  const added = await ProgressModel.updateOne(absentFilter, {
    $push: {
      chapterProgress: {
        chapterId,
        status: 'in_progress',
        startedAt: now,
        completedAt: null,
        requiredExerciseAcknowledgments: [],
      },
    },
    $set: { currentChapterId: chapterId },
  })

  // A concurrent request may have inserted this chapter after our absent check.
  // In that case, update only the current chapter and leave its completion state intact.
  if ((added.matchedCount ?? added.n ?? 0) === 0) {
    await ProgressModel.updateOne({
      user: userId,
      course: courseId,
      'chapterProgress.chapterId': chapterId,
    }, { $set: { currentChapterId: chapterId } })
  }

  const progress = await ProgressModel.findOne({ user: userId, course: courseId })
  if (!progress) throw new Error('Course progress disappeared while opening a chapter.')
  return progress
}

function stableCompletionSummary(progress) {
  const chapters = curriculum.sections.flatMap((section) => section.chapters)
  const states = new Map((progress.chapterProgress || []).map((item) => [item.chapterId, item]))
  const completed = chapters.filter((chapter) => states.get(chapter.id)?.status === 'completed').length
  const percentage = chapters.length ? Math.round((completed / chapters.length) * 10000) / 100 : 0
  return { chapters, states, completed, total: chapters.length, percentage, complete: completed === chapters.length }
}

async function issueCertificateIfEligible(user, course, progress, CertificateModel) {
  const summary = stableCompletionSummary(progress)
  progress.canonicalCompletionPercentage = summary.percentage
  if (!summary.complete || !course.certificateEligible) return { courseCompleted: summary.complete, certificateIssued: false, certificate: null }

  const completedAt = progress.canonicalCompletedAt || new Date()
  progress.canonicalCompletedAt = completedAt
  const result = await CertificateModel.findOneAndUpdate(
    { user: user.id || user._id, course: course.id || course._id },
    { $setOnInsert: {
      certificateId: `BE-${crypto.randomUUID()}`,
      recipientName: user.name,
      courseTitle: course.title,
      issueDate: completedAt,
      completionDate: completedAt,
      verificationStatus: 'valid',
    } },
    { upsert: true, new: true },
  )
  return { courseCompleted: true, certificateIssued: Boolean(result), certificate: result || null }
}

export async function evaluateLessonCompletion({
  user,
  course,
  lesson,
  progress,
  AssessmentAttemptModel = AssessmentAttempt,
}) {
  const requiredAssessments = lesson.assessments.filter((assessment) => assessment.required)
  const requiredExercises = lesson.exercises.filter((exercise) => exercise.required)
  const state = chapterState(progress, lesson.chapterId)
  const acknowledgments = new Set(state?.requiredExerciseAcknowledgments || [])
  const unmetAssessments = []

  for (const assessment of requiredAssessments) {
    const passed = await AssessmentAttemptModel.exists({
      user: user.id || user._id,
      course: course.id || course._id,
      chapterId: lesson.chapterId,
      assessmentId: assessment.id,
      passed: true,
    })
    if (!passed) unmetAssessments.push(assessment.id)
  }

  const unmetExercises = requiredExercises
    .filter((exercise) => !acknowledgments.has(exercise.id))
    .map((exercise) => exercise.id)

  return {
    canComplete: unmetAssessments.length === 0 && unmetExercises.length === 0,
    unmetAssessments,
    unmetExercises,
    hasRequirements: requiredAssessments.length > 0 || requiredExercises.length > 0,
  }
}

export async function getCourseProgress({ user, course, ProgressModel = Progress }) {
  const progress = await ProgressModel.findOne({ user: user.id || user._id, course: course.id || course._id })
  const empty = progress || { chapterProgress: [], currentChapterId: null, canonicalCompletionPercentage: 0 }
  const summary = stableCompletionSummary(empty)
  return {
    courseId: String(course.id || course._id),
    currentChapterId: empty.currentChapterId || null,
    totalChapters: summary.total,
    completedChapters: summary.completed,
    completionPercentage: summary.percentage,
    chapters: summary.chapters.map((chapter) => {
      const state = summary.states.get(chapter.id)
      return {
        chapterId: chapter.id,
        status: state?.status || 'not_started',
        startedAt: state?.startedAt || null,
        completedAt: state?.completedAt || null,
        requiredExerciseAcknowledgments: [...(state?.requiredExerciseAcknowledgments || [])],
      }
    }),
  }
}

export async function openLessonProgress({ user, course, chapterId, ProgressModel = Progress, now = new Date() }) {
  if (!chapterById(chapterId)) return null
  return ensureStartedChapter({ user, course, chapterId, ProgressModel, now })
}

export async function updateLessonProgress({
  user,
  course,
  lesson,
  status,
  ProgressModel = Progress,
  AssessmentAttemptModel = AssessmentAttempt,
  CertificateModel = Certificate,
  now = new Date(),
}) {
  const progress = await ensureStartedChapter({ user, course, chapterId: lesson.chapterId, ProgressModel, now })
  const state = chapterState(progress, lesson.chapterId)
  let completion = { courseCompleted: false, certificateIssued: false, certificate: null }

  if (status === 'completed' && state.status !== 'completed') {
    const result = await evaluateLessonCompletion({ user, course, lesson, progress, AssessmentAttemptModel })
    if (!result.canComplete) throw new CompletionRequirementsError(result)
    state.status = 'completed'
    state.completedAt = now
    const summary = stableCompletionSummary(progress)
    progress.canonicalCompletionPercentage = summary.percentage
    if (summary.complete && !progress.canonicalCompletedAt) progress.canonicalCompletedAt = now
    completion = await issueCertificateIfEligible(user, course, progress, CertificateModel)
  } else {
    const summary = stableCompletionSummary(progress)
    progress.canonicalCompletionPercentage = summary.percentage
    completion.courseCompleted = summary.complete
  }

  await progress.save()
  return { progress, ...completion }
}

export async function acknowledgeRequiredExercise({
  user,
  course,
  lesson,
  exerciseId,
  ProgressModel = Progress,
  AssessmentAttemptModel = AssessmentAttempt,
  CertificateModel = Certificate,
  now = new Date(),
}) {
  const exercise = lesson.exercises.find((item) => item.id === exerciseId)
  if (!exercise) return { found: false }
  if (!exercise.required) return { found: true, required: false, progress: null }

  const progress = await ensureStartedChapter({ user, course, chapterId: lesson.chapterId, ProgressModel, now })
  const state = chapterState(progress, lesson.chapterId)
  state.requiredExerciseAcknowledgments ||= []
  if (!state.requiredExerciseAcknowledgments.includes(exerciseId)) state.requiredExerciseAcknowledgments.push(exerciseId)

  let completion = { courseCompleted: false, certificateIssued: false, certificate: null }
  const requirements = await evaluateLessonCompletion({ user, course, lesson, progress, AssessmentAttemptModel })
  if (requirements.canComplete && state.status !== 'completed') {
    state.status = 'completed'
    state.completedAt = now
    const summary = stableCompletionSummary(progress)
    progress.canonicalCompletionPercentage = summary.percentage
    if (summary.complete && !progress.canonicalCompletedAt) progress.canonicalCompletedAt = now
    completion = await issueCertificateIfEligible(user, course, progress, CertificateModel)
  } else {
    progress.canonicalCompletionPercentage = stableCompletionSummary(progress).percentage
  }
  await progress.save()
  return { found: true, required: true, acknowledged: true, progress, ...completion }
}

export async function completeLessonIfRequirementsMet({
  user,
  course,
  lesson,
  ProgressModel = Progress,
  AssessmentAttemptModel = AssessmentAttempt,
  CertificateModel = Certificate,
  now = new Date(),
}) {
  const progress = await ensureStartedChapter({ user, course, chapterId: lesson.chapterId, ProgressModel, now })
  const state = chapterState(progress, lesson.chapterId)
  const requirements = await evaluateLessonCompletion({ user, course, lesson, progress, AssessmentAttemptModel })
  if (!requirements.canComplete) throw new CompletionRequirementsError(requirements)
  state.status = 'completed'
  state.completedAt ||= now
  const summary = stableCompletionSummary(progress)
  progress.canonicalCompletionPercentage = summary.percentage
  if (summary.complete && !progress.canonicalCompletedAt) progress.canonicalCompletedAt = now
  const completion = await issueCertificateIfEligible(user, course, progress, CertificateModel)
  await progress.save()
  return { progress, requirements, ...completion }
}
