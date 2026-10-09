import { useEffect, useState } from 'react'
import Brand from './Brand.jsx'
import CommerceAdmin from './CommerceAdmin.jsx'
import CourseAudioAdmin from './CourseAudioAdmin.jsx'
import CertificateAdmin from './CertificateAdmin.jsx'
import { api, getAdminLearners } from '../services/api.js'

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [summary, setSummary] = useState({ transactions: 0, paid: 0, certificates: 0, learners: 0 })
  const [learners, setLearners] = useState([])
  const [courseId, setCourseId] = useState('')
  const [showCourseAudio, setShowCourseAudio] = useState(false)
  const [courses, setCourses] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { user: currentUser } = await api('/auth/me')
        if (currentUser.role !== 'super_admin') {
          await api('/auth/logout', { method: 'POST' })
          window.location.replace('/super-admin?denied=1')
          return
        }
        const [transactions, certificates, learnerRows, courses] = await Promise.all([api('/admin/transactions'), api('/admin/certificates'), getAdminLearners(), api('/courses')])
        if (active) {
          setUser(currentUser)
          setCourseId(courses.find((item) => item.slug === 'ai-powered-developer-productivity')?.id || '')
          setCourses(courses)
          setSummary({ transactions: transactions.length, paid: transactions.filter((item) => ['paid', 'successful'].includes(item.status)).length, certificates: certificates.length, learners: learnerRows.length })
          setLearners(learnerRows)
        }
      } catch (requestError) {
        if (active) {
          if (requestError.message.toLowerCase().includes('authentication')) window.location.replace('/super-admin')
          else setError(requestError.message)
        }
      } finally {
        if (active) setBusy(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }) } finally { window.location.assign('/super-admin') }
  }

  if (busy) return <main className="admin-loading"><span className="eyebrow">BRIANE-DEV / ADMIN</span><p>Checking administrator access…</p></main>
  if (error) return <main className="admin-loading"><span className="eyebrow">BRIANE-DEV / ADMIN</span><p className="admin-form-error">{error}</p><a className="button button-secondary" href="/">Return to homepage</a></main>
  if (!user) return null

  return <main className="admin-dashboard-page">
    <header className="admin-dashboard-header"><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><div><span className="admin-user-label">SUPER ADMIN / {user.name}</span><button className="button button-secondary" onClick={logout}>Sign out</button></div></header>
    <section className="admin-dashboard-intro"><span className="eyebrow">PLATFORM / OVERVIEW</span><h1>Super Admin dashboard</h1><p>Browse courses, manage learner accounts, and control course audio and certificates.</p></section>
    <section className="admin-summary-grid" aria-label="Commerce summary">
      <article><span>TRANSACTIONS</span><strong>{summary.transactions}</strong><small>BrianE-Dev records</small></article>
      <article><span>CONFIRMED PAYMENTS</span><strong>{summary.paid}</strong><small>Verified and paid</small></article>
      <article><span>CERTIFICATES</span><strong>{summary.certificates}</strong><small>Issued to learners</small></article>
      <article><span>LEARNER ACCOUNTS</span><strong>{summary.learners}</strong><small>Registered learner profiles</small></article>
    </section>
    <section className="admin-learners-section" aria-labelledby="admin-learners-title">
      <div className="admin-learners-heading"><div><span className="eyebrow">LEARNER ACCOUNTS</span><h2 id="admin-learners-title">Learner biodata</h2></div><p>Profile details saved by learners.</p></div>
      {learners.length ? <div className="admin-learners-grid">{learners.map((learner) => <article className="admin-learner-card" key={learner.id}><header><div><h3>{learner.name}</h3><a href={'mailto:' + learner.email}>{learner.email}</a></div><span>{learner.profile.occupation || 'Learner'}</span></header><dl>{[['Phone', learner.profile.phone], ['Date of birth', learner.profile.dateOfBirth], ['Gender', learner.profile.gender.replaceAll('_', ' ')], ['Country', learner.profile.country], ['State / region', learner.profile.state], ['City', learner.profile.city], ['Address', learner.profile.address], ['Organization', learner.profile.organization]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><LearnerStatusControl learner={learner} onChange={(updated) => setLearners((rows) => rows.map((row) => row.id === learner.id ? { ...row, disabled: updated.disabled } : row))}/></article>)}</div> : <p className="admin-learners-empty">No learner accounts yet.</p>}
    </section>
    <section className="admin-courses-section"><div className="admin-learners-heading"><div><span className="eyebrow">COURSES / ADMIN ACCESS</span><h2>Course library</h2></div><p>Read and navigate the course without affecting learner progress or submitting assessments.</p></div><div className="admin-course-grid">{courses.map((course) => <article key={course.id}><span className="eyebrow">{course.sections.reduce((sum, section) => sum + section.chapters.length, 0)} CHAPTERS</span><h3>{course.title}</h3><p>{course.description}</p><a className="button button-primary" href={'/courses/' + encodeURIComponent(course.slug) + '/learn/' + encodeURIComponent(course.sections[0]?.chapters[0]?.id || 'chapter-ai-assisted-developer')}>Open course</a></article>)}</div></section>
    {courseId && <section className="admin-audio-section"><div className="admin-audio-heading"><div><span className="eyebrow">COURSE CONTENT / AUDIO</span><h2>Course audio</h2><p>Check narration status or generate audio on demand.</p></div><button className="button button-secondary" type="button" onClick={() => setShowCourseAudio((shown) => !shown)}>{showCourseAudio ? 'Hide audio tools' : 'Open audio tools'}</button></div>{showCourseAudio && <CourseAudioAdmin courseId={courseId}/>}</section>}
    <CertificateAdmin courses={courses}/>
    <CommerceAdmin standalone />
  </main>
}

function LearnerStatusControl({ learner, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    setBusy(true); setError('')
    try {
      const result = await api(`/admin/learners/${encodeURIComponent(learner.id)}/status`, { method: 'PATCH', body: JSON.stringify({ disabled: !learner.disabled }) })
      onChange(result)
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <div className="admin-learner-actions"><span className={learner.disabled ? 'learner-status-disabled' : 'learner-status-active'}>{learner.disabled ? 'Disabled' : 'Active'}</span><button className="button button-secondary" type="button" disabled={busy} onClick={toggle}>{busy ? 'Saving…' : learner.disabled ? 'Enable learner' : 'Disable learner'}</button>{error && <small role="alert">{error}</small>}</div>
}
