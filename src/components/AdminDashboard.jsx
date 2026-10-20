import { useEffect, useState } from 'react'
import Brand from './Brand.jsx'
import CommerceAdmin from './CommerceAdmin.jsx'
import CourseAudioAdmin from './CourseAudioAdmin.jsx'
import CertificateAdmin from './CertificateAdmin.jsx'
import { API_URL, api, getAdminLearners } from '../services/api.js'

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [summary, setSummary] = useState({ transactions: 0, paid: 0, certificates: 0, learners: 0 })
  const [learners, setLearners] = useState([])
  const [courseId, setCourseId] = useState('')
  const [showCourseAudio, setShowCourseAudio] = useState(false)
  const [courses, setCourses] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [business, setBusiness] = useState(null)
  const [requests, setRequests] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [contacts, setContacts] = useState([])
  const [campaignForm, setCampaignForm] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('briane-dev-theme') || 'dark')

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
        const [transactions, certificates, learnerRows, courses, overview, requestList, campaignRows, contactRows] = await Promise.all([api('/admin/transactions'), api('/admin/certificates'), getAdminLearners(), api('/courses'), api('/admin/business/overview'), api('/admin/business/requests'), api('/admin/business/campaigns'), api('/admin/business/contacts')])
        if (active) {
          setUser(currentUser)
          setCourseId(courses.find((item) => item.slug === 'ai-powered-developer-productivity')?.id || '')
          setCourses(courses)
          setSummary({ transactions: transactions.length, paid: transactions.filter((item) => ['paid', 'successful'].includes(item.status)).length, certificates: certificates.length, learners: learnerRows.length })
          setLearners(learnerRows)
          setBusiness(overview)
          setRequests(requestList.rows)
          setCampaigns(campaignRows)
          setContacts(contactRows)
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('briane-dev-theme', theme)
  }, [theme])

  async function saveCampaign(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const campaign = campaignForm.id
        ? await api(`/admin/business/campaigns/${encodeURIComponent(campaignForm.id)}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/admin/business/campaigns', { method: 'POST', body: JSON.stringify(body) })
      setCampaigns((rows) => campaignForm.id ? rows.map((row) => row._id === campaign._id ? campaign : row) : [campaign, ...rows])
      setCampaignForm(null)
    } catch (requestError) { setError(requestError.message) }
  }

  async function exportRequests() {
    const response = await fetch(`${API_URL}/admin/business/requests.csv`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) { setError('Request export could not be downloaded.'); return }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'briane-dev-requests.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  async function updateRequest(row, patch) {
    try {
      const updated = await api(`/admin/business/requests/${encodeURIComponent(row._id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setRequests((items) => items.map((item) => item._id === row._id ? { ...item, status: updated.status } : item))
    } catch (requestError) { setError(requestError.message) }
  }

  if (busy) return <main className="admin-loading"><span className="eyebrow">BRIANE-DEV / ADMIN</span><p>Checking administrator access…</p></main>
  if (error) return <main className="admin-loading"><span className="eyebrow">BRIANE-DEV / ADMIN</span><p className="admin-form-error">{error}</p><a className="button button-secondary" href="/">Return to homepage</a></main>
  if (!user) return null

  return <main className="admin-dashboard-page">
    <aside className="admin-sidebar" aria-label="Super Admin navigation"><a href="/admin" className="admin-sidebar-brand"><Brand /></a><div><span>OVERVIEW</span><a href="#overview">Dashboard</a></div><div><span>EDUCATION</span><a href="#courses">Course Management</a><a href="#learners">Students and Enrollments</a><a href="#course-audio">Audio and Ebook Status</a><a href="#certificates">Certificates</a></div><div><span>BUSINESS</span><a href="/services">Marketing Website</a><a href="#requests">Quote Requests and Enquiries</a><a href="#contacts">Contacts and Leads</a><a href="#campaigns">Email Campaigns</a></div><div><span>ADMINISTRATION</span><a href="#settings">Settings</a><button type="button" onClick={logout}>Logout</button></div></aside>
    <header className="admin-dashboard-header"><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><div><span className="admin-user-label">SUPER ADMIN / {user.name}</span><button className="button button-secondary" onClick={logout}>Sign out</button></div></header>
    <section id="overview" className="admin-dashboard-intro"><span className="eyebrow">PLATFORM / OVERVIEW</span><h1>Super Admin dashboard</h1><p>Education operations, business requests, contacts, and campaign drafts.</p></section>
    <section className="admin-summary-grid" aria-label="Commerce summary">
      <article><span>TRANSACTIONS</span><strong>{summary.transactions}</strong><small>BrianE-Dev records</small></article>
      <article><span>CONFIRMED PAYMENTS</span><strong>{summary.paid}</strong><small>Verified and paid</small></article>
      <article><span>CERTIFICATES</span><strong>{summary.certificates}</strong><small>Issued to learners</small></article>
      <article><span>LEARNER ACCOUNTS</span><strong>{summary.learners}</strong><small>Registered learner profiles</small></article>
    </section>
    {business && <section className="admin-summary-grid" aria-label="Business summary"><article><span>UNVERIFIED USERS</span><strong>{business.unverifiedUsers}</strong><small>Awaiting verification</small></article><article><span>ENQUIRIES</span><strong>{business.enquiries}</strong><small>All contact requests</small></article><article><span>QUOTE REQUESTS</span><strong>{business.quotes}</strong><small>All project briefs</small></article><article><span>NEW REQUESTS</span><strong>{business.unassigned}</strong><small>Needs review</small></article></section>}
    <section id="requests" className="admin-learners-section" aria-labelledby="business-requests-title"><div className="admin-learners-heading"><div><span className="eyebrow">BUSINESS / CRM</span><h2 id="business-requests-title">Recent requests</h2></div><button className="button button-secondary" type="button" onClick={exportRequests}>Export CSV</button></div>{requests.length ? <div className="admin-business-list">{requests.map((row) => <article key={row._id}><div><strong>{row.reference}</strong><span>{row.kind === 'quote' ? 'Quote request' : 'Contact enquiry'} · {row.status}</span><select aria-label={`Status for ${row.reference}`} value={row.status} onChange={(event) => updateRequest(row, { status: event.target.value })}>{['New', 'Under Review', 'Awaiting Customer', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Closed'].map((status) => <option key={status}>{status}</option>)}</select><button type="button" className="admin-note-button" onClick={() => { const note = window.prompt(`Internal note for ${row.reference}`); if (note?.trim()) updateRequest(row, { note: note.trim() }) }}>Add internal note</button></div><div><strong>{row.name}</strong><a href={`mailto:${row.email}`}>{row.email}</a></div><p>{row.subject || row.message}</p></article>)}</div> : <p>No requests yet.</p>}</section>
    <section id="contacts" className="admin-learners-section"><div className="admin-learners-heading"><div><span className="eyebrow">BUSINESS / CONTACTS & LEADS</span><h2>Contacts and lead pipeline</h2><p>Marketing consent is separate from business follow-up.</p></div><button className="button button-secondary" type="button" onClick={async () => { const response = await fetch(`${API_URL}/admin/business/contacts.csv`, { credentials: 'include', cache: 'no-store' }); if (!response.ok) return setError('Contact export could not be downloaded.'); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'briane-dev-contacts.csv'; anchor.click(); URL.revokeObjectURL(url) }}>Export contacts</button></div>{contacts.length ? <div className="admin-business-list">{contacts.map((contact) => <article key={contact._id}><div><strong>{contact.name}</strong><a href={`mailto:${contact.email}`}>{contact.email}</a><select aria-label={`Lead status for ${contact.email}`} value={contact.leadStatus} onChange={async (event) => { const leadStatus = event.target.value; try { await api(`/admin/business/contacts/${encodeURIComponent(contact._id)}`, { method: 'PATCH', body: JSON.stringify({ leadStatus }) }); setContacts((rows) => rows.map((row) => row._id === contact._id ? { ...row, leadStatus } : row)) } catch (requestError) { setError(requestError.message) } }}>{['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Converted', 'Not Proceeding'].map((status) => <option key={status}>{status}</option>)}</select><button type="button" className="admin-note-button" onClick={async () => { const note = window.prompt(`Follow-up note for ${contact.name}`); if (!note?.trim()) return; try { const updated = await api(`/admin/business/contacts/${encodeURIComponent(contact._id)}`, { method: 'PATCH', body: JSON.stringify({ note: note.trim() }) }); setContacts((rows) => rows.map((row) => row._id === contact._id ? updated : row)) } catch (requestError) { setError(requestError.message) } }}>Add follow-up note</button></div><div><strong>{contact.company || 'Individual contact'}</strong><span>Source: {contact.source} · Marketing: {contact.marketingConsent && !contact.unsubscribedAt ? 'Consented' : 'Not subscribed'}</span><span>Activity records: {contact.activities?.length || 0}</span></div></article>)}</div> : <p>No contacts yet.</p>}</section>
    <section id="learners" className="admin-learners-section" aria-labelledby="admin-learners-title">
      <div className="admin-learners-heading"><div><span className="eyebrow">LEARNER ACCOUNTS</span><h2 id="admin-learners-title">Learner biodata</h2></div><p>Profile details saved by learners.</p></div>
      {learners.length ? <div className="admin-learners-grid">{learners.map((learner) => <article className="admin-learner-card" key={learner.id}><header><div><h3>{learner.name}</h3><a href={'mailto:' + learner.email}>{learner.email}</a></div><span>{learner.profile.occupation || 'Learner'}</span></header><dl>{[['Phone', learner.profile.phone], ['Date of birth', learner.profile.dateOfBirth], ['Gender', learner.profile.gender.replaceAll('_', ' ')], ['Country', learner.profile.country], ['State / region', learner.profile.state], ['City', learner.profile.city], ['Address', learner.profile.address], ['Organization', learner.profile.organization]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><LearnerStatusControl learner={learner} onChange={(updated) => setLearners((rows) => rows.map((row) => row.id === learner.id ? { ...row, disabled: updated.disabled } : row))}/></article>)}</div> : <p className="admin-learners-empty">No learner accounts yet.</p>}
    </section>
    <section id="courses" className="admin-courses-section"><div className="admin-learners-heading"><div><span className="eyebrow">COURSES / ADMIN ACCESS</span><h2>Course library</h2></div><p>Read and navigate the course without affecting learner progress or submitting assessments.</p></div><div className="admin-course-grid">{courses.map((course) => <article key={course.id}><span className="eyebrow">{course.sections.reduce((sum, section) => sum + section.chapters.length, 0)} CHAPTERS</span><h3>{course.title}</h3><p>{course.description}</p><a className="button button-primary" href={'/courses/' + encodeURIComponent(course.slug) + '/learn/' + encodeURIComponent(course.sections[0]?.chapters[0]?.id || 'chapter-ai-assisted-developer')}>Open course</a></article>)}</div></section>
    {courseId && <section id="course-audio" className="admin-audio-section"><div className="admin-audio-heading"><div><span className="eyebrow">COURSE CONTENT / AUDIO</span><h2>Course audio</h2><p>Check narration status or generate audio on demand.</p></div><button className="button button-secondary" type="button" onClick={() => setShowCourseAudio((shown) => !shown)}>{showCourseAudio ? 'Hide audio tools' : 'Open audio tools'}</button></div>{showCourseAudio && <CourseAudioAdmin courseId={courseId}/>}</section>}
    <section id="campaigns" className="admin-learners-section"><div className="admin-learners-heading"><div><span className="eyebrow">BUSINESS / EMAIL</span><h2>Email campaign drafts</h2><p>Drafts are stored in MongoDB. Sending and scheduling require a configured transport and worker.</p></div><button className="button button-primary" type="button" onClick={() => setCampaignForm({ id: '', name: '', subject: '', previewText: '', html: '', text: '' })}>Create draft</button></div>{campaignForm && <form className="admin-campaign-form" onSubmit={saveCampaign}><label>Campaign name<input name="name" required maxLength="160" defaultValue={campaignForm.name}/></label><label>Subject<input name="subject" maxLength="200" defaultValue={campaignForm.subject}/></label><label>Preview text<input name="previewText" maxLength="250" defaultValue={campaignForm.previewText}/></label><label>Plain-text body<textarea name="text" rows="6" defaultValue={campaignForm.text}/></label><label>HTML body<textarea name="html" rows="8" defaultValue={campaignForm.html}/></label><div><button className="button button-primary">Save draft</button><button type="button" className="button button-secondary" onClick={() => setCampaignForm(null)}>Cancel</button></div></form>}{campaigns.length ? <div className="admin-business-list">{campaigns.map((row) => <article key={row._id}><div><strong>{row.name}</strong><span>{row.status}</span>{row.status === 'Draft' && <button type="button" className="admin-note-button" onClick={() => setCampaignForm({ id: row._id, name: row.name, subject: row.subject, previewText: row.previewText, html: row.html, text: row.text })}>Edit draft</button>}</div><p>{row.subject || 'Subject not set'} · Sending unavailable until email is configured.</p></article>)}</div> : <p>No campaigns yet.</p>}</section>
    <section id="settings" className="admin-learners-section"><div className="admin-learners-heading"><div><span className="eyebrow">ADMINISTRATION / SETTINGS</span><h2>Appearance</h2></div><button className="button button-secondary" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>Use {theme === 'dark' ? 'light' : 'dark'} mode</button></div><p>Theme preference is saved in this browser and applies immediately.</p></section>
    <div id="certificates"><CertificateAdmin courses={courses}/></div>
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
