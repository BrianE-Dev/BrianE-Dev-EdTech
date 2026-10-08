import { useEffect, useState } from 'react'
import Brand from './Brand.jsx'
import CommerceAdmin from './CommerceAdmin.jsx'
import CourseAudioAdmin from './CourseAudioAdmin.jsx'
import { api, getAdminLearners } from '../services/api.js'

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [summary, setSummary] = useState({ transactions: 0, paid: 0, certificates: 0, learners: 0 })
  const [learners, setLearners] = useState([])
  const [courseId, setCourseId] = useState('')
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
    <section className="admin-dashboard-intro"><span className="eyebrow">COMMERCE / OVERVIEW</span><h1>Super Admin dashboard</h1><p>Manage regional pricing, review BrianE-Dev payments, and check course purchases and certificates.</p></section>
    <section className="admin-summary-grid" aria-label="Commerce summary">
      <article><span>TRANSACTIONS</span><strong>{summary.transactions}</strong><small>BrianE-Dev records</small></article>
      <article><span>CONFIRMED PAYMENTS</span><strong>{summary.paid}</strong><small>Verified and paid</small></article>
      <article><span>CERTIFICATES</span><strong>{summary.certificates}</strong><small>Issued to learners</small></article>
      <article><span>LEARNER ACCOUNTS</span><strong>{summary.learners}</strong><small>Registered learner profiles</small></article>
    </section>
    <section className="admin-learners-section" aria-labelledby="admin-learners-title">
      <div className="admin-learners-heading"><div><span className="eyebrow">LEARNER ACCOUNTS</span><h2 id="admin-learners-title">Learner biodata</h2></div><p>Profile details saved by learners.</p></div>
      {learners.length ? <div className="admin-learners-grid">{learners.map((learner) => <article className="admin-learner-card" key={learner.id}><header><div><h3>{learner.name}</h3><a href={'mailto:' + learner.email}>{learner.email}</a></div><span>{learner.profile.occupation || 'Learner'}</span></header><dl>{[['Phone', learner.profile.phone], ['Date of birth', learner.profile.dateOfBirth], ['Gender', learner.profile.gender.replaceAll('_', ' ')], ['Country', learner.profile.country], ['State / region', learner.profile.state], ['City', learner.profile.city], ['Address', learner.profile.address], ['Organization', learner.profile.organization]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></article>)}</div> : <p className="admin-learners-empty">No learner accounts yet.</p>}
    </section>
    {courseId && <CourseAudioAdmin courseId={courseId}/>}
    <CommerceAdmin standalone />
  </main>
}
