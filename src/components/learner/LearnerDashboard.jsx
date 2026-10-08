import { useEffect, useState } from 'react'
import Brand from '../Brand.jsx'
import { getCertificateDownloadUrl, getCertificateVerificationUrl, getCertificates, getCourseEbookStatus, getCourseEbookUrl, getCourseProgress, getCurrentUser, getLearnerProfile, getPurchases, logoutUser, saveLearnerProfile } from '../../services/api.js'
import { curriculum } from '../../data/curriculum.js'

const emptyProfile = { name: '', phone: '', dateOfBirth: '', gender: '', country: '', state: '', city: '', address: '', occupation: '', organization: '' }
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'settings', label: 'Settings' },
]

function profileFormValues(data) {
  return { ...emptyProfile, ...(data.profile || {}), name: data.name || '' }
}

export default function LearnerDashboard() {
  const [state, setState] = useState({ status: 'loading', user: null, courses: [], certificates: [], error: '' })
  const [activeView, setActiveView] = useState('dashboard')
  const [profileDraft, setProfileDraft] = useState(emptyProfile)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [{ user }, purchases, savedProfile] = await Promise.all([getCurrentUser(), getPurchases(), getLearnerProfile()])
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
        if (active) {
          setProfileDraft(profileFormValues(savedProfile))
          setState({ status: 'loaded', user, courses, certificates, error: '' })
        }
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

  function updateProfile(event) {
    setProfileDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
    setProfileMessage('')
    setProfileError('')
  }

  async function saveProfile(event) {
    event.preventDefault()
    setProfileBusy(true)
    setProfileMessage('')
    setProfileError('')
    try {
      const saved = await saveLearnerProfile(profileDraft)
      setProfileDraft(profileFormValues(saved))
      setState((current) => ({ ...current, user: { ...current.user, name: saved.name, email: saved.email } }))
      setProfileMessage('Your profile has been saved.')
    } catch (error) {
      setProfileError(error.message)
    } finally {
      setProfileBusy(false)
    }
  }

  if (state.status === 'loading') return <main className='learner-state'><p>Loading your learning space…</p></main>
  if (state.status === 'error') return <main className='learner-state'><h1>Unable to load your learning space</h1><p role='alert'>{state.error}</p><a className='button button-primary' href='/learn/login'>Sign in</a></main>

  const selectedCourse = state.courses[0]
  const courseSlug = selectedCourse?.course.slug || 'ai-powered-developer-productivity'
  const statuses = new Map((selectedCourse?.progress.chapters || []).map((chapter) => [chapter.chapterId, chapter.status]))

  return <main className='learner-app learner-dashboard-shell'>
    <header className='learner-header'><a href='/' aria-label='BrianE-Dev homepage'><Brand /></a><span className='learner-header-name'>{state.user.name}</span></header>
    <div className='learner-workspace'>
      <aside className='learner-sidebar' aria-label='Learner navigation'>
        <div className='learner-sidebar-person'><span className='learner-avatar'>{(state.user.name || 'L').trim().charAt(0).toUpperCase()}</span><div><strong>{state.user.name}</strong><span>{state.user.email}</span></div></div>
        <nav>{navigationItems.map((item) => <button key={item.id} type='button' className={activeView === item.id ? 'is-active' : ''} aria-current={activeView === item.id ? 'page' : undefined} onClick={() => setActiveView(item.id)}>{item.label}</button>)}</nav>
      </aside>

      <section className='learner-dashboard-content'>
        {activeView === 'dashboard' && <>
          <span className='eyebrow'>YOUR LEARNING SPACE</span>
          <h1>{state.courses.length ? 'Full Course Access' : 'Preview Access'}</h1>
          <p className='learner-lede'>{state.courses.length ? 'You’re enrolled in BrianE-Dev. Your progress is saved to your account.' : 'You’re currently exploring BrianE-Dev, ' + state.user.name + '.'}</p>
          {state.courses.length === 0 ? <article className='learner-empty-card'>
            <h2>Course access: Preview only</h2>
            <p>Your free account gives you access to the public Chapter 1 preview. Purchase the course to unlock all 43 chapters, progress tracking, assessments, and the ebook.</p>
            <a className='learner-text-link' href='/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer'>Start Chapter 1 Preview</a>
            <a className='button button-primary' href='/#pricing'>Enroll / Purchase</a>
          </article> : state.courses.map(({ course, progress, ebook }) => {
            const chapterStatuses = new Map(progress.chapters.map((chapter) => [chapter.chapterId, chapter.status]))
            const current = progress.currentChapterId && chapterStatuses.get(progress.currentChapterId) !== 'completed'
              ? progress.currentChapterId
              : progress.chapters.find((chapter) => chapter.status !== 'completed')?.chapterId
            const complete = progress.completedChapters === progress.totalChapters
            const certificate = state.certificates.find((item) => String(item.course) === String(course._id || course.id))
            const readerUrl = current ? '/courses/' + encodeURIComponent(course.slug) + '/learn/' + encodeURIComponent(current) : null
            return <article className='learner-course-card' key={course._id || course.id}>
              <div className='learner-course-heading'><div><span className='eyebrow'>COURSE / 01</span><h2>{course.title}</h2></div><div className='learner-course-progress'><span>PROGRESS</span><strong>{progress.completionPercentage}%</strong></div></div>
              <div className='learner-progress-track' role='progressbar' aria-label='Course completion' aria-valuemin='0' aria-valuemax='100' aria-valuenow={progress.completionPercentage}><span style={{ width: progress.completionPercentage + '%' }}/></div>
              <p>{progress.completedChapters} of {progress.totalChapters} chapters complete</p>
              <p className='learner-course-state'>{certificate ? 'Certificate issued' : complete ? 'Course complete - certificate record unavailable' : progress.completedChapters === 0 ? 'Not started' : 'In progress'}</p>
              <section className='learner-entitlement-card'><div><span className='eyebrow'>COURSE EBOOK</span><h3>{ebook.title}</h3><p>{ebook.available ? 'Included with your course purchase.' : 'The PDF is not published yet. Download access will appear here when it is available.'}</p></div>{ebook.available ? <a className='button button-secondary' href={getCourseEbookUrl(course._id || course.id)}>Download ebook</a> : <span className='entitlement-unavailable'>Not published</span>}</section>
              {complete ? <div className='learner-complete-message'><strong>Course complete</strong>{certificate && <><span>Certificate issued: {certificate.certificateId}</span><div className='learner-certificate-actions'><a className='button button-primary' href={getCertificateDownloadUrl(certificate.certificateId)}>Download certificate</a><a className='learner-text-link' href={getCertificateVerificationUrl(certificate.certificateId)} target='_blank' rel='noreferrer'>Verify certificate</a></div></>}</div>
                : <a className='button button-primary' href={readerUrl || '/courses/' + encodeURIComponent(course.slug) + '/learn/' + encodeURIComponent(progress.chapters[0].chapterId)}>{progress.currentChapterId ? 'Continue Learning' : 'Start Learning'}</a>}
            </article>
          })}
        </>}

        {activeView === 'profile' && <>
          <span className='eyebrow'>ACCOUNT / BIODATA</span><h1>Learner profile</h1>
          <p className='learner-lede'>Save the details you want BrianE-Dev administrators to see with your learner account.</p>
          <form className='learner-profile-form' onSubmit={saveProfile}>
            <div className='learner-profile-grid'>
              <label>Full name<input name='name' autoComplete='name' minLength='2' maxLength='120' required value={profileDraft.name} onChange={updateProfile}/></label>
              <label>Email address<input type='email' value={state.user.email} readOnly/></label>
              <label>Phone number<input name='phone' type='tel' autoComplete='tel' maxLength='40' value={profileDraft.phone} onChange={updateProfile}/></label>
              <label>Date of birth<input name='dateOfBirth' type='date' value={profileDraft.dateOfBirth} onChange={updateProfile}/></label>
              <label>Gender<select name='gender' value={profileDraft.gender} onChange={updateProfile}><option value=''>Choose an option</option><option value='female'>Female</option><option value='male'>Male</option><option value='non_binary'>Non-binary</option><option value='prefer_not_to_say'>Prefer not to say</option></select></label>
              <label>Country<input name='country' autoComplete='country-name' maxLength='100' value={profileDraft.country} onChange={updateProfile}/></label>
              <label>State / region<input name='state' autoComplete='address-level1' maxLength='100' value={profileDraft.state} onChange={updateProfile}/></label>
              <label>City<input name='city' autoComplete='address-level2' maxLength='100' value={profileDraft.city} onChange={updateProfile}/></label>
              <label>Occupation<input name='occupation' autoComplete='organization-title' maxLength='120' value={profileDraft.occupation} onChange={updateProfile}/></label>
              <label>Organization<input name='organization' autoComplete='organization' maxLength='120' value={profileDraft.organization} onChange={updateProfile}/></label>
              <label className='learner-profile-wide'>Address<textarea name='address' autoComplete='street-address' maxLength='240' rows='3' value={profileDraft.address} onChange={updateProfile}/></label>
            </div>
            {profileError && <p className='learner-error' role='alert'>{profileError}</p>}
            {profileMessage && <p className='learner-profile-success' role='status'>{profileMessage}</p>}
            <button className='button button-primary' type='submit' disabled={profileBusy}>{profileBusy ? 'Saving profile…' : 'Save profile'}</button>
          </form>
        </>}

        {activeView === 'curriculum' && <>
          <span className='eyebrow'>COURSE / CURRICULUM</span><h1>Curriculum</h1>
          <p className='learner-lede'>Browse the course chapters and continue where you left off.</p>
          {!selectedCourse && <article className='learner-empty-card learner-curriculum-access'><h2>Preview access</h2><p>Chapter 1 is available as a free preview. Purchase the course to unlock the full curriculum.</p><a className='button button-primary' href='/#pricing'>View course access</a></article>}
          <div className='learner-curriculum-list'>{curriculum.sections.map((section) => <section className='learner-curriculum-section' key={section.id}><span className='eyebrow'>PART {String(section.number).padStart(2, '0')}</span><h2>{section.title}</h2><ol>{section.chapters.map((chapter) => {
            const status = statuses.get(chapter.id)
            const label = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : status === 'not_started' ? 'Available' : chapter.id === 'chapter-ai-assisted-developer' ? 'Free preview' : selectedCourse ? 'Available' : 'Locked'
            return <li key={chapter.id}><a href={'/courses/' + encodeURIComponent(courseSlug) + '/learn/' + encodeURIComponent(chapter.id)}><span>Chapter {String(chapter.number).padStart(2, '0')}: {chapter.title}</span><small>{label}</small></a></li>
          })}</ol></section>)}</div>
        </>}

        {activeView === 'settings' && <>
          <span className='eyebrow'>ACCOUNT / SETTINGS</span><h1>Settings</h1>
          <section className='learner-settings-card'><div><h2>Sign out</h2><p>Sign out of your BrianE-Dev learner account on this device.</p></div><button className='button button-secondary' type='button' onClick={signOut}>Log out</button></section>
        </>}
      </section>
    </div>
  </main>
}
