import { useCallback, useEffect, useState } from 'react'
import Brand from '../Brand.jsx'
import { completeExercise, getCourse, getCourseProgress, getLesson, getLessonPreview, logoutUser, updateLessonProgress } from '../../services/api.js'
import ChapterNavigation from './ChapterNavigation.jsx'
import LessonAssessment from './LessonAssessment.jsx'
import LessonBlockRenderer from './LessonBlockRenderer.jsx'
import LessonTts from './LessonTts.jsx'
import LessonAudioPlayer from './LessonAudioPlayer.jsx'
import PurchaseGate from './PurchaseGate.jsx'

function readRoute() {
  const match = window.location.pathname.match(/^\/courses\/([^/]+)\/learn\/(chapter-[a-z0-9-]+)\/?$/)
  if (!match) return null
  try { return { courseSlug: decodeURIComponent(match[1]), chapterId: decodeURIComponent(match[2]) } } catch { return null }
}

function lessonErrorState(error) {
  if (error.status === 401) return { status: 'unauthenticated', message: 'Sign in to open this lesson.' }
  if (error.status === 403) return { status: 'denied', message: 'A confirmed purchase is required to read this lesson.' }
  if (error.status === 404) return { status: 'not-found', message: 'This lesson is not available yet or the chapter could not be found.' }
  return { status: 'error', message: 'We could not load this lesson. Please try again.' }
}

export default function CourseReader() {
  const { courseSlug, chapterId } = readRoute() || {}
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })

  const load = useCallback(async () => {
    if (!courseSlug || !chapterId) {
      setState({ status: 'not-found', data: null, error: 'This chapter link is not valid.' })
      return
    }
    setState({ status: 'loading', data: null, error: '' })
    let course = null
    try {
      course = await getCourse(courseSlug)
      if (!course.id) throw new Error('Course metadata is unavailable.')
      let response
      try {
        response = await getLesson(course.id, chapterId)
      } catch (error) {
        if (error.status !== 403 || error.code !== 'COURSE_PURCHASE_REQUIRED') throw error
        if (chapterId === 'chapter-ai-assisted-developer') {
          response = await getLessonPreview(courseSlug, chapterId)
        } else {
          const chapter = course.sections.flatMap((section) => section.chapters).find((item) => item.id === chapterId)
          setState({ status: 'purchase-required', data: { course, chapter }, error: '' })
          return
        }
      }
      setState({ status: 'loaded', data: { course, response }, error: '' })
    } catch (error) {
      const errorState = lessonErrorState(error)
      setState({ status: errorState.status, data: { course }, error: errorState.message })
    }
  }, [courseSlug, chapterId])

  useEffect(() => { load() }, [load, attempt])

  async function refreshProgress() {
    const progress = await getCourseProgress(state.data.course.id)
    const chapterState = progress.chapters.find((item) => item.chapterId === chapterId)
    setState((current) => ({
      ...current,
      data: {
        ...current.data,
        response: {
          ...current.data.response,
          progress: {
            status: chapterState?.status || 'not_started',
            startedAt: chapterState?.startedAt || null,
            completedAt: chapterState?.completedAt || null,
            percent: progress.completionPercentage,
            requiredExerciseAcknowledgments: chapterState?.requiredExerciseAcknowledgments || [],
          },
        },
      },
    }))
  }

  async function markComplete() {
    setState((current) => ({ ...current, error: '', completionBusy: true }))
    try {
      await updateLessonProgress(state.data.course.id, chapterId, 'completed')
      await refreshProgress()
    } catch (error) {
      setState((current) => ({ ...current, error: error.status === 409 ? 'Complete the required assessment and acknowledge required exercises before marking this chapter complete.' : error.message }))
    } finally {
      setState((current) => ({ ...current, completionBusy: false }))
    }
  }

  async function acknowledgeExercise(exerciseId) {
    try {
      await completeExercise(state.data.course.id, chapterId, exerciseId)
      await refreshProgress()
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }))
    }
  }

  async function refreshAfterAssessment() {
    try {
      await refreshProgress()
    } catch {
      setState((current) => ({ ...current, error: 'Your assessment was saved, but progress could not be refreshed. Reload the lesson to see the latest status.' }))
    }
  }

  async function signOut() {
    try { await logoutUser() } finally { window.location.assign(state.data?.response?.access?.isSuperAdmin ? '/super-admin' : '/learn/login') }
  }

  if (state.status === 'purchase-required') {
    const chapterTitle = state.data.chapter?.title || 'this chapter'
    return <main className="learner-state">
      <header className="learner-header"><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><div><a href="/#pricing">Course pricing</a><a href="/learn/login">Sign in</a></div></header>
      <section className="locked-lesson-state">
        <span className="eyebrow">CHAPTER {String(state.data.chapter?.number || '').padStart(2, '0')} / PURCHASE REQUIRED</span>
        <h1>{chapterTitle}</h1>
        <p>Chapter 1 has a free preview. The rest of Chapter 1 and Chapters 2–43 require a confirmed course purchase.</p>
        <PurchaseGate chapterTitle={chapterTitle}/>
      </section>
    </main>
  }

  if (state.status !== 'loaded') {
    const returnTo = encodeURIComponent(window.location.pathname)
    return <main className="learner-state">
      {state.status === 'loading' ? <p>Loading your lesson…</p> : <>
        <Brand/><h1>{state.status === 'denied' ? 'Course access required' : state.status === 'not-found' ? 'Lesson unavailable' : state.status === 'unauthenticated' ? 'Sign in to continue' : 'Unable to load lesson'}</h1>
        <p role={state.status === 'error' ? 'alert' : undefined}>{state.error}</p>
        {state.status === 'unauthenticated' && <a className="button button-primary" href={`/learn/login?returnTo=${returnTo}`}>Learner sign in</a>}
        {state.status === 'denied' && <a className="button button-primary" href="/#pricing">View course access</a>}
        {state.status === 'error' && <button className="button button-primary" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}
        <a className="learner-text-link" href="/learn">Back to learning space</a>
      </>}
    </main>
  }

  const { course, response } = state.data
  const { lesson, chapter, navigation, progress } = response
  const isPreview = response.access?.isPreview === true
  const isSuperAdmin = response.access?.isSuperAdmin === true
  const learnerProgress = progress || { status: 'not_started', percent: 0, requiredExerciseAcknowledgments: [] }
  const acknowledged = new Set(learnerProgress.requiredExerciseAcknowledgments || [])
  const hasRequiredActivities = lesson.assessments.some((assessment) => assessment.required)
    || lesson.exercises.some((exercise) => exercise.required)

  return <main className="learner-app reader-app">
    <header className="learner-header"><a href={isPreview ? '/' : isSuperAdmin ? '/admin' : '/learn'} aria-label="Back to learning space"><Brand /></a><div>{isPreview ? <><a href="/#pricing">Course pricing</a><a href="/learn/login">Sign in</a></> : <>{isSuperAdmin ? <a href="/admin">Admin dashboard</a> : <a href="/learn">My learning</a>}<button type="button" onClick={signOut}>Sign out</button></>}</div></header>
    <div className="reader-layout">
      <aside className="reader-sidebar">
        <a className="reader-course-link" href={isPreview ? '/#curriculum' : '/learn'}>{isPreview ? '← Course curriculum' : '← Learning space'}</a>
        <span className="eyebrow">SECTION {String(chapter.sectionNumber).padStart(2, '0')}</span>
        <h2>{chapter.sectionTitle}</h2>
        {isSuperAdmin ? <span className="preview-badge">Super Admin access · progress is not tracked</span> : isPreview ? <span className="preview-badge">Free preview · not saved to progress</span> : <><div className="reader-sidebar-progress"><span>Course progress</span><strong>{learnerProgress.percent}%</strong><div className="learner-progress-track"><span style={{ width: `${learnerProgress.percent}%` }}/></div></div>
          <span className={`reader-status reader-status-${learnerProgress.status}`}>{learnerProgress.status.replace('_', ' ')}</span></>}
      </aside>
      <article className="reader-main">
        <header className="reader-lesson-header"><span className="eyebrow">CHAPTER {String(chapter.number).padStart(2, '0')} / {course.title}</span>{isPreview && <span className="preview-badge">Free preview</span>}<h1>{lesson.title}</h1><p>{chapter.sectionTitle}</p></header>
        {lesson.objectives.length > 0 && <section className="reader-objectives"><h2>In this chapter</h2><ul>{lesson.objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul></section>}
        {isPreview ? <LessonTts/> : <LessonAudioPlayer courseId={course.id} chapterId={lesson.chapterId}/>}
        <LessonBlockRenderer blocks={lesson.blocks} courseId={course.id} chapterId={lesson.chapterId}/>
        {isPreview && <PurchaseGate preview/>}
        {!isPreview && lesson.exercises.length > 0 && <section className="reader-exercises"><span className="eyebrow">PRACTICE</span><h2>Exercises</h2>{lesson.exercises.map((exercise) => <article className="reader-exercise" key={exercise.id}>
          <div><h3>{exercise.title}</h3><p>{exercise.objective}</p></div>
          {exercise.required ? isSuperAdmin ? <span className="reader-optional-label">Admin access does not require exercise acknowledgment.</span> : <label className="reader-exercise-ack"><input type="checkbox" checked={acknowledged.has(exercise.id)} disabled={acknowledged.has(exercise.id)} onChange={() => acknowledgeExercise(exercise.id)}/><span>I completed this exercise. This is my acknowledgment, not an automated skill assessment.</span></label> : <span className="reader-optional-label">Optional</span>}
          <details><summary>Exercise instructions</summary><ol>{exercise.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>{exercise.constraints.length > 0 && <><h4>Constraints</h4><ul>{exercise.constraints.map((constraint, index) => <li key={index}>{constraint}</li>)}</ul></>}<p><strong>Expected outcome:</strong> {exercise.expectedOutcome}</p></details>
        </article>)}</section>}
        {!isPreview && !isSuperAdmin && <LessonAssessment courseId={course.id} chapterId={lesson.chapterId} assessments={lesson.assessments} onCompleted={refreshAfterAssessment}/>}
        {!isPreview && !isSuperAdmin && state.error && <p className="reader-error" role="alert">{state.error}</p>}
        {!isPreview && !isSuperAdmin && learnerProgress.status !== 'completed' && hasRequiredActivities && <section className="reader-completion"><div><strong>Complete the required activities</strong><p>This chapter completes automatically when you pass the required assessment and acknowledge required exercises.</p></div></section>}
        {!isPreview && !isSuperAdmin && learnerProgress.status !== 'completed' && !hasRequiredActivities && <section className="reader-completion"><div><strong>Finished this chapter?</strong><p>There are no required activities for this lesson.</p></div><button className="button button-primary" type="button" disabled={state.completionBusy} onClick={markComplete}>{state.completionBusy ? 'Saving…' : 'Mark chapter complete'}</button></section>}
        {!isPreview && !isSuperAdmin && learnerProgress.status === 'completed' && <p className="reader-completed-banner" role="status">Chapter completed and saved to your progress.</p>}
        <ChapterNavigation courseSlug={course.slug} previous={navigation.previous} next={navigation.next}/>
      </article>
    </div>
  </main>
}
