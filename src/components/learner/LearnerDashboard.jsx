import { useEffect, useState } from 'react'
import Brand from '../Brand.jsx'
import { getCertificates, getCourseProgress, getCurrentUser, getPurchases, logoutUser } from '../../services/api.js'

export default function LearnerDashboard() {
  const [state, setState] = useState({ status: 'loading', user: null, courses: [], certificates: [], error: '' })

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [{ user }, purchases, certificates] = await Promise.all([getCurrentUser(), getPurchases(), getCertificates()])
        if (user.role === 'super_admin') {
          window.location.replace('/admin')
          return
        }
        const courses = await Promise.all(purchases
          .filter((purchase) => purchase.course?.slug)
          .map(async (purchase) => ({
            course: purchase.course,
            progress: await getCourseProgress(purchase.course._id || purchase.course.id),
          })))
        if (active) setState({ status: 'loaded', user, courses, certificates, error: '' })
      } catch (error) {
        if (active) setState({ status: 'error', user: null, courses: [], certificates: [], error: error.message })
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function signOut() {
    try { await logoutUser() } finally { window.location.assign('/learn/login') }
  }

  if (state.status === 'loading') return <main className="learner-state"><p>Loading your learning space…</p></main>
  if (state.status === 'error') return <main className="learner-state"><h1>Unable to load your learning space</h1><p role="alert">{state.error}</p><a className="button button-primary" href="/learn/login">Sign in</a></main>

  return <main className="learner-app">
    <header className="learner-header"><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><div><span>{state.user.name}</span><button type="button" onClick={signOut}>Sign out</button></div></header>
    <section className="learner-dashboard-content">
      <span className="eyebrow">YOUR LEARNING SPACE</span>
      <h1>Continue learning</h1>
      <p className="learner-lede">Your course progress is saved to your account and follows the approved chapter order.</p>
      {state.courses.length === 0 ? <article className="learner-empty-card">
        <h2>No course access found</h2>
        <p>Course enrollment is connected to a confirmed purchase on your account.</p>
        <a className="button button-primary" href="/#pricing">View course access</a>
      </article> : state.courses.map(({ course, progress }) => {
        const statuses = new Map(progress.chapters.map((chapter) => [chapter.chapterId, chapter.status]))
        const current = progress.currentChapterId && statuses.get(progress.currentChapterId) !== 'completed'
          ? progress.currentChapterId
          : progress.chapters.find((chapter) => chapter.status !== 'completed')?.chapterId
        const complete = progress.completedChapters === progress.totalChapters
        const certificate = state.certificates.find((item) => String(item.course) === String(course._id || course.id))
        const readerUrl = current ? `/courses/${encodeURIComponent(course.slug)}/learn/${encodeURIComponent(current)}` : null
        return <article className="learner-course-card" key={course._id || course.id}>
          <div className="learner-course-heading"><div><span className="eyebrow">COURSE / 01</span><h2>{course.title}</h2></div><strong>{progress.completionPercentage}%</strong></div>
          <div className="learner-progress-track" role="progressbar" aria-label="Course completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.completionPercentage}><span style={{ width: `${progress.completionPercentage}%` }}/></div>
          <p>{progress.completedChapters} of {progress.totalChapters} chapters complete</p>
          {complete ? <div className="learner-complete-message"><strong>Course complete</strong>{certificate && <span>Certificate issued: {certificate.certificateId}</span>}</div>
            : <a className="button button-primary" href={readerUrl || `/courses/${encodeURIComponent(course.slug)}/learn/${encodeURIComponent(progress.chapters[0].chapterId)}`}>{progress.currentChapterId ? 'Resume course' : 'Start learning'}</a>}
        </article>
      })}
    </section>
  </main>
}
