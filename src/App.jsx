import { useCallback, useEffect, useRef, useState } from 'react'
import Brand from './components/Brand.jsx'
import CurriculumCard from './components/CurriculumCard.jsx'
import FaqList from './components/FaqList.jsx'
import FeatureCard from './components/FeatureCard.jsx'
import Icon from './components/Icon.jsx'
import PricingCard from './components/PricingCard.jsx'
import SectionHeading from './components/SectionHeading.jsx'
import { courseFormats, features, plans, questions } from './data/homepage.js'
import { curriculum, totalChapters } from './data/curriculum.js'
import { api } from './services/api.js'
import { getPaymentReturnState } from './services/paymentReturn.js'
import AdminLogin from './components/AdminLogin.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import LearnerLogin from './components/learner/LearnerLogin.jsx'
import LearnerRegister from './components/learner/LearnerRegister.jsx'
import LearnerDashboard from './components/learner/LearnerDashboard.jsx'
import CourseReader from './components/learner/CourseReader.jsx'
import './App.css'

function LandingPage() {
  const sampleSection = curriculum.sections[1]
  const sampleChapter = sampleSection.chapters[0]
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('briane-dev-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [paymentReturn, setPaymentReturn] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [heroRun, setHeroRun] = useState(0)
  const heroRef = useRef(null)

  const verifyPaymentReturn = useCallback(async (reference) => {
    setPaymentReturn({ state: 'checking', message: 'Checking payment status with Paystack…', reference })
    try {
      const result = await api('/brianedev/payments/verify', { method: 'POST', body: JSON.stringify({ reference }) })
      setPaymentReturn({ ...getPaymentReturnState(reference, result), reference })
    } catch {
      setPaymentReturn({ ...getPaymentReturnState(reference, null), reference })
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHeroRun((run) => run + 1)
    }, { threshold: 0.08 })

    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('briane-dev-theme', theme)
  }, [theme])

  useEffect(() => {
    document.title = `${curriculum.title} | BrianE-Dev`
    const description = document.querySelector('meta[name="description"]')
    if (description) description.content = curriculum.description
  }, [])

  useEffect(() => {
    api('/pricing').then(setPricing).catch((error) => setPricingError(error.message))
    api('/auth/me').then(({ user }) => setIsAdmin(user.role === 'super_admin')).catch(() => setIsAdmin(false))
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'return') {
      const reference = params.get('reference') || params.get('trxref') || ''
      window.setTimeout(() => verifyPaymentReturn(reference), 0)
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    }
  }, [verifyPaymentReturn])

  const closeMenu = () => setMenuOpen(false)
  const purchaseCourse = async () => {
    setPaymentBusy(true); setPricingError('')
    try {
      await api('/auth/me')
      const { authorizationUrl } = await api('/brianedev/payments/initialize', { method: 'POST', body: JSON.stringify({ productId: 'ai-powered-developer-productivity' }) })
      window.location.assign(authorizationUrl)
    } catch (error) {
      setPaymentBusy(false)
      if (error.status === 401) {
        window.location.assign(`/learn/login?returnTo=${encodeURIComponent('/#pricing')}`)
        return
      }
      setPricingError(error.message)
    }
  }
  const regionalPrice = pricing ? {
    ...plans[0],
    price: new Intl.NumberFormat(pricing.currency === 'NGN' ? 'en-NG' : undefined, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 2 }).format(pricing.currentPrice),
    currentPrice: pricing.currentPrice,
    originalPrice: pricing.promotionActive ? new Intl.NumberFormat(pricing.currency === 'NGN' ? 'en-NG' : undefined, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 2 }).format(pricing.originalPrice) : '',
    discountLabel: pricing.promotionActive ? `${pricing.discountType === 'percentage' ? pricing.discountValue : Math.round(pricing.discount / pricing.originalPrice * 100)}% OFF` : '',
  } : null

  return (
    <div className="site-shell" data-theme={theme}>
      <header className="topbar">
        <span onClick={closeMenu}><Brand /></span>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#curriculum" onClick={closeMenu}>Curriculum</a>
          <a href="#preview" onClick={closeMenu}>Free Preview</a>
          <a href="#courses" onClick={closeMenu}>Course Format</a>
          <a href="#method" onClick={closeMenu}>Method</a>
          <a href="#pricing" onClick={closeMenu}>Pricing</a>
          <a href="#faq" onClick={closeMenu}>FAQs</a>
        </nav>
        <div className="nav-actions">
          {isAdmin && <a className="sign-in" href="/admin">Dashboard</a>}
          <a className="sign-in" href="/learn/login">Learner sign in</a>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15}/><span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
          <a className="button button-small button-primary" href="#pricing">Enroll Now <Icon name="arrow" size={14}/></a>
        </div>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'}/></button>
      </header>

      <main id="top">
        <section ref={heroRef} className={`hero-section section-wrap ${heroRun > 0 ? 'hero-is-visible' : ''}`}>
          <div className="hero-copy" key={`hero-copy-${heroRun}`}>
            <div className="eyebrow"><span className="status-dot"/> ENGINEERING EDUCATION <span className="eyebrow-sep">/</span> AI WORKFLOWS</div>
            <h1>Master AI Throughout the Software Lifecycle.<br/><span>Reading-First. Code-Centric.</span></h1>
            <p className="hero-description">No isolated demos. Learn to work more effectively with AI across real software workflowsâ€”from planning and debugging to testing, refactoring, documentation, and delivery.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#curriculum">Explore Curriculum <Icon name="arrow" size={16}/></a>
              <a className="button button-secondary" href="#method"><span className="play-mini"><Icon name="book" size={11}/></span> How the course works</a>
            </div>
            <div className="hero-stats">
              <div><strong>Read. Listen. Apply.</strong><span>Learn in your own workflow</span></div>
              <div><strong>{curriculum.sections.length} Sections <i>Â·</i> {totalChapters} Chapters</strong><span>Structured course content</span></div>
              <div><strong>Depth <i>Â·</i> Code Impact</strong><span>Skills you can apply at work</span></div>
            </div>
          </div>
          <div className="hero-visual" key={`hero-visual-${heroRun}`}>
            <div className="visual-window-bar"><div className="window-dots"><i/><i/><i/></div><span>COURSE OVERVIEW</span><span className="live-label"><b/> AI WORKFLOWS</span></div>
            <div className="hero-image-wrap"><img src="/course-hero.png" alt="Software engineer working through an AI-assisted coding lesson"/></div>
            <div className="visual-caption"><span><Icon name="book" size={13}/> DEVELOPER PRODUCTIVITY</span><span>01 / {curriculum.sections.length} â€” {curriculum.sections[0].title}</span></div>
          </div>
        </section>

        <section className="feature-band section-wrap" aria-label="Platform highlights">
          <div className="feature-intro"><span className="eyebrow">ENGINEERED FOR ENGINEERS</span><h2>Serious Instruction for Real Software Work</h2><p>BrianE-Dev is built around how software is actually developed. Lessons connect AI-assisted development to practical engineering workflows, giving you the context to understand the work, evaluate AI output, and make better technical decisions.</p></div>
          {features.map((feature) => <FeatureCard key={feature.title} {...feature}/>) }
        </section>

        <section id="preview" className="course-preview-section section-wrap section-block" aria-labelledby="course-preview-title">
          <div className="course-preview-copy">
            <span className="eyebrow">START HERE / FREE COURSE PREVIEW</span>
            <h2 id="course-preview-title">See how the course teaches.</h2>
            <p>Open the free Chapter 1 preview to read a real lesson and try its narration controls before enrolling.</p>
          </div>
          <a className="course-preview-card" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">
            <span className="course-preview-card-label"><Icon name="book" size={14}/> CHAPTER 1 / FREE PREVIEW</span>
            <strong>The AI-Assisted Developer</strong>
            <span>Open Chapter 1 and try narration <Icon name="arrow" size={14}/></span>
          </a>
        </section>

        <section id="curriculum" className="curriculum-section section-wrap section-block">
          <div className="course-name">{curriculum.title}</div>
          <SectionHeading eyebrow="CURRICULUM / PROGRESSION" title={<>{curriculum.sections.length} Sections <span>Â·</span> {totalChapters} Chapters</>} description="A structured path for using AI effectively throughout the software development lifecycle." action={<a className="text-link" href="#courses">Course content <Icon name="arrow" size={15}/></a>}/>
          <div className="curriculum-grid">{curriculum.sections.map((section) => <CurriculumCard section={section} key={section.id}/>)}</div>
          <div className="curriculum-footer"><span><span className="status-dot green-dot"/> WRITTEN LESSONS Â· CODE EXAMPLES Â· AI WORKFLOWS</span><span>{totalChapters} APPROVED CHAPTERS</span></div>
        </section>

        <section id="method" className="split-section section-wrap section-block">
          <div className="split-copy"><span className="eyebrow">LEARNING EXPERIENCE</span><h2>Reading-First Technical Instruction</h2><p>Learn how to use AI across real software development workflows&mdash;not just how to write better prompts.</p><p>Study practical explanations, realistic code examples, AI prompts, and repeatable workflows designed to improve how you plan, build, debug, test, and ship software.</p><ul className="check-list"><li><Icon name="check"/> Developer workflows explained in clear, written lessons</li><li><Icon name="check"/> Real software contexts with practical code examples</li><li><Icon name="check"/> AI prompts and workflows you can adapt to your own development work</li></ul><a className="text-link" href="#curriculum">Explore the 43-Chapter Curriculum <Icon name="arrow" size={15}/></a></div>
          <div className="lesson-panel"><div className="panel-top"><span><i className="tiny-square"/> SECTION {String(sampleSection.number).padStart(2, '0')} &#183; CHAPTER {String(sampleChapter.number).padStart(2, '0')}</span><span className="complete-tag">WRITTEN LESSON <b>&#9679;</b></span></div><div className="lesson-content"><div className="lesson-kicker">{sampleSection.title.toUpperCase()}</div><h3>{sampleChapter.title}</h3><p>Learn how to use ChatGPT as part of everyday software engineering&mdash;from understanding unfamiliar code and planning changes to debugging problems and reasoning through technical decisions.</p><div className="code-snippet"><span className="code-line"><i>01</i><code><b>const</b> task = {'{'}</code></span><span className="code-line"><i>02</i><code>&nbsp; goal: <em>"understand the change"</em>,</code></span><span className="code-line"><i>03</i><code>&nbsp; files: [<em>"auth.js", "session.js",</em></code></span><span className="code-line"><i>04</i><code>&nbsp; &nbsp; <em>"middleware.js"</em>],</code></span><span className="code-line"><i>05</i><code>&nbsp; context: <em>"existing authentication flow"</em></code></span><span className="code-line"><i>06</i><code>{'}'}</code></span></div><div className="lesson-callout"><span>AI WORKFLOW</span><p>Give ChatGPT the relevant files and explain the change you need to understand. Ask it to trace the request flow, identify dependencies, and highlight potential side effects before you modify the code.</p></div><div className="lesson-callout"><span>COURSE FORMAT</span><p>Read the explanation. Study the example. Understand the reasoning behind the workflow. Then adapt the approach to your own development work.</p></div><a className="text-link" href="#curriculum">Explore the Curriculum <Icon name="arrow" size={15}/></a></div><div className="lesson-controls"><button type="button" onClick={() => setPlaying(!playing)} className="audio-play" aria-label={playing ? 'Pause narration' : 'Play narration'}><Icon name={playing ? 'pause' : 'play'} size={13}/></button><div className="audio-track"><span className={playing ? 'audio-progress is-playing' : 'audio-progress'}/></div><span className="audio-time">AUDIO NARRATION</span><button type="button" className="speed-button" onClick={(event) => { event.currentTarget.textContent = event.currentTarget.textContent === `1\u00D7` ? `1.25\u00D7` : `1\u00D7` }}>{`1\u00D7`}</button></div></div>
        </section>

        <section id="courses" className="architecture-section section-wrap section-block">
          <SectionHeading eyebrow="COURSE CONTENT" title="AI-Powered Developer Productivity for Software Engineers" description="Learn how to integrate AI into real software engineering workflows—from planning and reasoning to implementation, debugging, testing, documentation, refactoring, and everyday development work."/>
          <p className="course-content-context">Lessons use practical software contexts to show not only <strong>what to do with AI</strong>, but <strong>how to reason about the work and evaluate the results.</strong></p>
          <div className="method-grid course-format-grid">{courseFormats.map((format, index) => <article key={format.title}><span>CONTENT FORMAT {String(index + 1).padStart(2, '0')}</span><h3>{format.title}</h3><p>{format.description}</p></article>)}</div>
          <div className="course-content-notes"><article><span className="eyebrow">LEARNING APPROACH</span><p>Every lesson connects the <strong>concept</strong>, the <strong>software context</strong>, and the <strong>engineering reasoning</strong> behind the workflow.</p><p>Read the explanation. Examine the code. Study the AI interaction. Understand the reasoning. Then adapt the approach to your own development work.</p></article><article><span className="eyebrow">AUDIO NARRATION</span><h3>Prefer to listen while reviewing?</h3><p>TTS narration gives you another way to consume the written lessons while keeping the complete technical content available for deeper reading.</p></article></div>
        </section>
        <section id="pricing" className="pricing-section section-wrap section-block"><div className="center-heading"><span className="eyebrow">ACCESS / ENROLLMENT</span><h2>Individual Course Access</h2><p>Get access to the complete AI-powered developer productivity course.</p></div>{paymentReturn && <div className={`payment-message payment-message-${paymentReturn.state}`} role={paymentReturn.state === 'error' ? 'alert' : 'status'}>{paymentReturn.message}{paymentReturn.state !== 'confirmed' && <button type="button" className="payment-retry" onClick={() => verifyPaymentReturn(paymentReturn.reference)} disabled={paymentReturn.state === 'checking'}>{paymentReturn.state === 'checking' ? 'Checking…' : 'Retry verification'}</button>}</div>}<div className="pricing-grid">{regionalPrice ? <PricingCard item={regionalPrice} selected busy={paymentBusy} error={pricingError} onSelect={purchaseCourse}/> : <p className="pricing-error" role="alert">{pricingError || 'Loading current Nigerian pricing…'}</p>}</div><p className="pricing-note"><Icon name="lock" size={13}/> Pay securely with Paystack. Available to customers in Nigeria. <span>·</span> Course access <span>·</span> Written lessons <span>·</span> AI prompts and workflows <span>·</span> TTS narration</p></section>

        <section id="faq" className="faq-section section-wrap section-block"><div className="center-heading"><span className="eyebrow">FAQ</span><h2>Frequently Asked Inquiries</h2><p>Clear answers about the curriculum, learning format, and access.</p></div><FaqList items={questions} openIndex={openFaq} onToggle={setOpenFaq}/></section>

        <section className="final-cta"><div><span className="eyebrow">AI-POWERED DEVELOPER PRODUCTIVITY</span><h2>Use AI Throughout<br/>the Software Lifecycle.</h2><p>Study practical AI workflows for planning, debugging, refactoring, documentation, testing, and delivery.</p><div className="hero-actions"><a className="button button-primary" href="#curriculum">View the Curriculum <Icon name="arrow" size={15}/></a><a className="button button-secondary" href="#courses">Explore Course Content</a></div></div></section>
      </main>

      <footer className="site-footer section-wrap"><Brand/><span>ENGINEERING EDUCATION / BUILT FOR THE SOFTWARE LIFECYCLE</span><div><a href="#curriculum">CURRICULUM</a><a href="#preview">FREE PREVIEW</a><a href="#pricing">ACCESS</a><a href="#faq">SUPPORT</a></div><span>Â© 2026 BRIANE-DEV</span></footer>
      <nav className="mobile-dock" aria-label="Quick navigation"><a href="#top"><Icon name="grid" size={17}/><span>HOME</span></a><a href="#curriculum"><Icon name="book" size={17}/><span>CURRICULUM</span></a><a href="#preview"><Icon name="code" size={17}/><span>PREVIEW</span></a><a href="#pricing"><Icon name="lock" size={17}/><span>ACCESS</span></a></nav>
    </div>
  )
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/super-admin') return <AdminLogin />
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminDashboard />
  if (path === '/learn/login') return <LearnerLogin />
  if (path === '/learn/register') return <LearnerRegister />
  if (path === '/learn') return <LearnerDashboard />
  if (/^\/courses\/[^/]+\/learn\/chapter-[a-z0-9-]+$/.test(path)) return <CourseReader />
  return <LandingPage />
}

export default App
