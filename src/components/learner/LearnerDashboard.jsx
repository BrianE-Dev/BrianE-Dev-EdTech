import { useEffect, useState } from 'react'
import Brand from '../Brand.jsx'
import { getCertificateDownloadUrl, getCertificateVerificationUrl, getCertificates, getCourseEbookStatus, getCourseEbookUrl, getCourseProgress, getCurrentUser, getPurchases, logoutUser } from '../../services/api.js'
import { curriculum } from '../../data/curriculum.js'

export default function LearnerDashboard() {
  const [state, setState] = useState({ status: 'loading', user: null, courses: [], certificates: [], error: '' })

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [{ user }, purchases] = await Promise.all([getCurrentUser(), getPurchases()])
        if (user.role === 'super_admin') {
          window.location.replace('/admin')
          return
        }
        const certificates = purchases.length ? await getCertificates() : []
        const courses = await Promise.all(purchases
          .filter((purchase) => purchase.course?.slug)
          .map(async (purchase) => {
            const courseId = purchase.course._id || purchase.course.id
            const [progress, ebook] = await Promise.all([getCourseProgress(courseId), getCourseEbookStatus(courseId)])
            return { course: purchase.course, progress, ebook }
          }))
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
      <h1>{state.courses.length ? 'Full Course Access' : 'Preview Access'}</h1>
      <p className="learner-lede">{state.courses.length ? 'You’re enrolled in BrianE-Dev. Your progress is saved to your account.' : `You’re currently exploring BrianE-Dev, ${state.user.name}.`}</p>
      {state.courses.length === 0 ? <article className="learner-empty-card">
        <h2>Course access: Preview only</h2>
        <p>Your free account gives you access to the public Chapter 1 preview. Purchase the course to unlock all 43 chapters, progress tracking, assessments, and the ebook.</p>
        <a className="learner-text-link" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">Start Chapter 1 Preview</a>
        <a className="button button-primary" href="/#pricing">Enroll / Purchase</a>
      </article> : state.courses.map(({ course, progress, ebook }) => {
        const statuses = new Map(progress.chapters.map((chapter) => [chapter.chapterId, chapter.status]))
        const current = progress.currentChapterId && statuses.get(progress.currentChapterId) !== 'completed'
          ? progress.currentChapterId
          : progress.chapters.find((chapter) => chapter.status !== 'completed')?.chapterId
        const complete = progress.completedChapters === progress.totalChapters
        const certificate = state.certificates.find((item) => String(item.course) === String(course._id || course.id))
        const readerUrl = current ? `/courses/${encodeURIComponent(course.slug)}/learn/${encodeURIComponent(current)}` : null
        return <article className="learner-course-card" key={course._id || course.id}>
          <div className="learner-course-heading"><div><span className="eyebrow">COURSE / 01</span><h2>{course.title}</h2></div><div className="learner-course-progress"><span>PROGRESS</span><strong>{progress.completionPercentage}%</strong></div></div>
          <div className="learner-progress-track" role="progressbar" aria-label="Course completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.completionPercentage}><span style={{ width: `${progress.completionPercentage}%` }}/></div>
          <p>{progress.completedChapters} of {progress.totalChapters} chapters complete</p>
          <p className="learner-course-state">{certificate ? 'Certificate issued' : complete ? 'Course complete - certificate record unavailable' : progress.completedChapters === 0 ? 'Not started' : 'In progress'}</p>
          <section className="learner-entitlement-card"><div><span className="eyebrow">COURSE EBOOK</span><h3>{ebook.title}</h3><p>{ebook.available ? 'Included with your course purchase.' : 'The PDF is not published yet. Download access will appear here when it is available.'}</p></div>{ebook.available ? <a className="button button-secondary" href={getCourseEbookUrl(course._id || course.id)}>Download ebook</a> : <span className="entitlement-unavailable">Not published</span>}</section>
          {complete ? <div className="learner-complete-message"><strong>Course complete</strong>{certificate && <><span>Certificate issued: {certificate.certificateId}</span><div className="learner-certificate-actions"><a className="button button-primary" href={getCertificateDownloadUrl(certificate.certificateId)}>Download certificate</a><a className="learner-text-link" href={getCertificateVerificationUrl(certificate.certificateId)} target="_blank" rel="noreferrer">Verify certificate</a></div></>}</div>
            : <a className="button button-primary" href={readerUrl || `/courses/${encodeURIComponent(course.slug)}/learn/${encodeURIComponent(progress.chapters[0].chapterId)}`}>{progress.currentChapterId ? 'Continue Learning' : 'Start Learning'}</a>}
          <details className="learner-curriculum"><summary>Course curriculum - {curriculum.sections.length} sections, {progress.totalChapters} chapters</summary>{curriculum.sections.map((section) => <section key={section.id}><h3>Part {section.number}: {section.title}</h3><ol>{section.chapters.map((chapter) => {
            const status = statuses.get(chapter.id) || 'not_started'
            const currentChapter = chapter.id === current && status !== 'completed'
            return <li className={`learner-curriculum-${status}${currentChapter ? ' is-current' : ''}`} key={chapter.id}><a href={`/courses/${encodeURIComponent(course.slug)}/learn/${encodeURIComponent(chapter.id)}`}><span>Chapter {String(chapter.number).padStart(2, '0')}: {chapter.title}</span><small>{status === 'completed' ? 'Completed' : currentChapter ? 'Current' : status === 'in_progress' ? 'In progress' : 'Available'}</small></a></li>
          })}</ol></section>)}</details>
        </article>
      })}
    </section>
  </main>
}
