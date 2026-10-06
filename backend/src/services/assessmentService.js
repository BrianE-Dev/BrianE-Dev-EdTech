import { z } from 'zod'
import { AssessmentAttempt } from '../models/index.js'
import { completeLessonIfRequirementsMet, CompletionRequirementsError } from './lessonCompletion.js'

const submissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    optionId: z.string().min(1),
  }).strict()).min(1),
}).strict()

export class InvalidAssessmentSubmissionError extends Error {
  constructor(message, code = 'INVALID_ASSESSMENT_ANSWER') {
    super(message)
    this.name = 'InvalidAssessmentSubmissionError'
    this.code = code
  }
}

async function createSequentialAttempt(data, AssessmentAttemptModel) {
  for (let retry = 0; retry < 5; retry += 1) {
    const attemptNumber = (await AssessmentAttemptModel.countDocuments({
      user: data.user,
      course: data.course,
      chapterId: data.chapterId,
      assessmentId: data.assessmentId,
    })) + 1

    try {
      return await AssessmentAttemptModel.create({ ...data, attemptNumber })
    } catch (error) {
      if (error.code !== 11000 || retry === 4) throw error
    }
  }
  throw new Error('Unable to sequence assessment attempt')
}

export async function submitLessonAssessment({
  user,
  course,
  lesson,
  body,
  AssessmentAttemptModel = AssessmentAttempt,
  completionDependencies = {},
  now = new Date(),
}) {
  const parsed = submissionSchema.safeParse(body)
  if (!parsed.success) throw new InvalidAssessmentSubmissionError('Assessment answers are malformed.', 'INVALID_ASSESSMENT')
  if (!lesson.assessments.length) throw new InvalidAssessmentSubmissionError('This lesson has no assessment.', 'ASSESSMENT_NOT_FOUND')

  const answers = parsed.data.answers
  const submittedIds = answers.map((answer) => answer.questionId)
  if (new Set(submittedIds).size !== submittedIds.length) {
    throw new InvalidAssessmentSubmissionError('Duplicate assessment question IDs are not allowed.')
  }

  const assessmentMap = new Map(lesson.assessments.map((assessment) => [assessment.id, assessment]))
  const evaluated = answers.map((answer) => {
    const assessment = assessmentMap.get(answer.questionId)
    if (!assessment) throw new InvalidAssessmentSubmissionError('An assessment question was not found.')
    if (!assessment.options.some((option) => option.id === answer.optionId)) {
      throw new InvalidAssessmentSubmissionError('An answer option is not valid for its question.')
    }
    const isCorrect = assessment.correctOptionId === answer.optionId
    return { assessment, optionId: answer.optionId, isCorrect }
  })

  const userId = user.id || user._id
  const courseId = course.id || course._id
  const attempts = []
  for (const item of evaluated) {
    const score = item.isCorrect ? 1 : 0
    attempts.push(await createSequentialAttempt({
      user: userId,
      course: courseId,
      chapterId: lesson.chapterId,
      assessmentId: item.assessment.id,
      optionId: item.optionId,
      isCorrect: item.isCorrect,
      score,
      correctAnswers: item.isCorrect ? 1 : 0,
      totalQuestions: 1,
      passed: score >= item.assessment.passThreshold,
      contentVersion: lesson.contentVersion,
      submittedAt: now,
    }, AssessmentAttemptModel))
  }

  const required = lesson.assessments.filter((assessment) => assessment.required)
  const allRequiredAnsweredAndPassed = required.every((assessment) => {
    const answer = evaluated.find((item) => item.assessment.id === assessment.id)
    return Boolean(answer && (answer.isCorrect ? 1 : 0) >= assessment.passThreshold)
  })
  const correctAnswers = evaluated.filter((item) => item.isCorrect).length
  const score = evaluated.length ? Math.round((correctAnswers / evaluated.length) * 100) / 100 : 0
  const passThreshold = required.length === 1 ? required[0].passThreshold : null

  let completion = null
  if (required.length && allRequiredAnsweredAndPassed) {
    try {
      completion = await completeLessonIfRequirementsMet({
        user,
        course,
        lesson,
        AssessmentAttemptModel,
        ...completionDependencies,
        now,
      })
    } catch (error) {
      if (!(error instanceof CompletionRequirementsError)) throw error
    }
  }

  return {
    assessment: {
      score,
      correctAnswers,
      totalQuestions: evaluated.length,
      passThreshold,
      passed: allRequiredAnsweredAndPassed,
      attemptNumber: attempts.length === 1 ? attempts[0].attemptNumber : null,
      attemptId: attempts[0]._id || attempts[0].id,
    },
    progress: completion?.progress || null,
    completion,
  }
}
