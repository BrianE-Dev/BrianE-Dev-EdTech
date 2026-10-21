import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Brand from './components/Brand.jsx'
import CurriculumCard from './components/CurriculumCard.jsx'
import FaqList from './components/FaqList.jsx'
import FeatureCard from './components/FeatureCard.jsx'
import Icon from './components/Icon.jsx'
import PricingCard from './components/PricingCard.jsx'
import SectionHeading from './components/SectionHeading.jsx'
import { courseFormats, features, plans, questions } from './data/homepage.js'
import { curriculum, totalChapters } from './data/curriculum.js'
import { courseStructuredData } from './data/structuredData.js'
import { api } from './services/api.js'
import { getPaymentReturnState } from './services/paymentReturn.js'
import AdminLogin from './components/AdminLogin.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import LearnerLogin from './components/learner/LearnerLogin.jsx'
import LearnerRegister from './components/learner/LearnerRegister.jsx'
import LearnerDashboard from './components/learner/LearnerDashboard.jsx'
import CourseReader from './components/learner/CourseReader.jsx'
import BusinessPages from './components/BusinessPages.jsx'
import PasswordRecovery from './components/PasswordRecovery.jsx'
import SiteNavigation from './components/SiteNavigation.jsx'
import DeveloperIntelligenceSphere from './components/DeveloperIntelligenceSphere.jsx'
import { getPromotionDateRange } from './utils/promotionDates.js'
import './App.css'

function LandingPage({ children = null, metadataPath = '/', isCourseLanding = false }) {
  const sampleSection = curriculum.sections[1]
  const sampleChapter = sampleSection.chapters[0]
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('briane-dev-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const [openFaq, setOpenFaq] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [checkoutEmail, setCheckoutEmail] = useState('')
  const [paymentReturn, setPaymentReturn] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [heroRun, setHeroRun] = useState(0)
  const heroRef = useRef(null)
  const heroSquareRef = useRef(null)

  function moveHeroSquare(event) {
    if (event.pointerType === 'touch' || !heroSquareRef.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const square = heroSquareRef.current
    square.style.left = `${event.clientX - bounds.left}px`
    square.style.top = `${event.clientY - bounds.top}px`
    square.style.opacity = '1'
  }

  function hideHeroSquare() {
    if (heroSquareRef.current) heroSquareRef.current.style.opacity = '0'
  }
  const verifyPaymentReturn = useCallback(async (reference) => {
    setPaymentReturn({ state: 'checking', message: 'Checking payment status with Paystack…', reference })
    try {
      const result = await api('/brianedev/payments/verify-public', { method: 'POST', body: JSON.stringify({ reference }) })
      setPaymentReturn({ ...getPaymentReturnState(reference, result), reference })
    } catch {
      setPaymentReturn({ ...getPaymentReturnState(reference, null), reference })
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return undefined
    if (typeof window.IntersectionObserver !== 'function') return undefined

    let wasVisible = false
    let observer
    try {
      observer = new window.IntersectionObserver((entries) => {
        const entry = entries?.[0]
        if (!entry) return
        if (entry.isIntersecting && !wasVisible) setHeroRun((run) => run + 1)
        wasVisible = entry.isIntersecting
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      observer.observe(hero)
    } catch {
      return undefined
    }
    return () => observer?.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('briane-dev-theme', theme)
  }, [theme])

  useEffect(() => {
    const scrollToHash = () => {
      const targetId = window.location.hash.slice(1)
      if (!targetId) return
      document.getElementById(decodeURIComponent(targetId))?.scrollIntoView()
    }

    const frame = window.requestAnimationFrame(scrollToHash)
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [])

  useEffect(() => {
    const [title, description] = pageDescriptions[metadataPath] || pageDescriptions['/']
    setPageMetadata(metadataPath, title, description)
  }, [metadataPath])

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

  const purchaseCourse = useCallback(async () => {
    setPaymentBusy(true); setPricingError('')
    try {
      const { authorizationUrl } = await api('/brianedev/payments/initialize-public', { method: 'POST', body: JSON.stringify({ email: checkoutEmail }) })
      window.location.assign(authorizationUrl)
    } catch (error) {
      setPaymentBusy(false)
      setPricingError(error.message)
    }
  }, [checkoutEmail])
  const regionalPrice = pricing ? {
    ...plans[0],
    price: new Intl.NumberFormat(pricing.currency === 'NGN' ? 'en-NG' : undefined, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 2 }).format(pricing.currentPrice),
    currentPrice: pricing.currentPrice,
    originalPrice: pricing.promotionActive ? new Intl.NumberFormat(pricing.currency === 'NGN' ? 'en-NG' : undefined, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 2 }).format(pricing.originalPrice) : '',
    discountLabel: pricing.promotionActive ? `${pricing.discountType === 'percentage' ? pricing.discountValue : Math.round(pricing.discount / pricing.originalPrice * 100)}% OFF` : '',
    promotionDates: getPromotionDateRange(pricing.startDate, pricing.endDate),
  } : null

  return (
    <div className="site-shell" data-theme={theme}>
      <SiteNavigation theme={theme} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} isAdmin={isAdmin}/>

      <main id="top">
        <section ref={heroRef} onPointerMove={moveHeroSquare} onPointerLeave={hideHeroSquare} className={`hero-section section-wrap ${heroRun > 0 ? 'hero-is-visible' : ''}`}>
          <span ref={heroSquareRef} className="hero-pointer-square" aria-hidden="true"/>
          <div className="hero-copy" key={`hero-copy-${heroRun}`}>
            <div className="eyebrow"><span className="status-dot"/> ENGINEERING EDUCATION <span className="eyebrow-sep">/</span> AI WORKFLOWS</div>
            <h1>{isCourseLanding ? <>AI-Powered Developer Productivity<br/><span>for Software Engineers.</span></> : <>Master AI Throughout the Software Lifecycle.<br/><span>Reading-First. Code-Centric.</span></>}</h1>
            <p className="hero-description">{isCourseLanding ? 'Learn AI-powered developer workflows, coding with AI, debugging strategies, and practical techniques for planning, testing, documentation, and software engineering productivity.' : 'No isolated demos. Learn to work more effectively with AI across real software workflows—from planning and debugging to testing, refactoring, documentation, and delivery.'}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#curriculum">Explore Curriculum <Icon name="arrow" size={16}/></a>
              <a className="button button-secondary" href="#method"><span className="play-mini"><Icon name="book" size={11}/></span> How the course works</a>
            </div>
            <a className="hero-services-link" href="#home-services">Need a website or digital product? <strong>Explore our services <Icon name="arrow" size={13}/></strong></a>
            <div className="hero-stats">
              <div><strong>Read. Listen. Apply.</strong><span>Learn in your own workflow</span></div>
              <div><strong>{curriculum.sections.length} Sections <i>·</i> {totalChapters} Chapters</strong><span>Structured course content</span></div>
              <div><strong>Depth <i>·</i> Code Impact</strong><span>Skills you can apply at work</span></div>
            </div>
          </div>
          <div className="hero-visual" key={`hero-visual-${heroRun}`}>
            <div className="hero-image-wrap"><DeveloperIntelligenceSphere/></div>
          </div>
        </section>

        {children}

        <section id="home-services" className="home-services section-wrap" aria-labelledby="home-services-title">
          <div className="home-services-heading"><div><span className="eyebrow">BRIANE-DEV / DIGITAL SERVICES</span><h2 id="home-services-title">Digital services for your next idea.</h2><p>Explore practical web, commerce, and software solutions for your business.</p></div><a className="button button-secondary" href="/services">Explore all services <Icon name="arrow" size={15}/></a></div>
          <a className="home-services-feature" href="/services"><img src="/course-hero.png" alt="Software developer working with digital tools across multiple screens"/><span className="home-services-overlay"/><span className="home-services-copy"><span className="eyebrow">WEBSITE DESIGN / E-COMMERCE / WEB APPLICATIONS</span><strong>Build a better digital experience for your business.</strong><span className="button button-primary">Discover our services <Icon name="arrow" size={15}/></span></span></a>
          <div className="home-services-tiles">
            <a href="/services"><img src="/service-websites.svg" alt="Website layout preview showing a clear landing page design"/><strong>Websites & landing pages</strong><span>Clear paths from first visit to action</span></a>
            <a href="/services"><img src="/service-commerce.svg" alt="Online shop interface with products and a checkout flow"/><strong>Commerce & custom apps</strong><span>Digital tools designed around your work</span></a>
            <a href="/services"><img src="/service-integrations.svg" alt="Connected software services represented as an integration workflow"/><strong>Integrations & support</strong><span>Connect systems and keep them improving</span></a>
          </div>
        </section>

        <section className="feature-band section-wrap" aria-label="Platform highlights">
          <div className="feature-intro"><span className="eyebrow">ENGINEERED FOR ENGINEERS</span><h2>Serious Instruction for Real Software Work</h2><p>BrianE-Dev is built around how software is actually developed. Lessons connect AI-assisted development to practical engineering workflows, giving you the context to understand the work, evaluate AI output, and make better technical decisions.</p></div>
          {features.map((feature) => <FeatureCard key={feature.title} {...feature}/>) }
        </section>



        <section id="preview" className="course-preview-section section-wrap section-block" aria-labelledby="course-preview-title">
          <div className="course-preview-copy">
            <span className="eyebrow"><span className="preview-live-dot"/> YOUR FIRST LESSON IS FREE</span>
            <h2 id="course-preview-title">Meet your new AI pair programmer.</h2>
            <p>See how thoughtful engineers use AI without handing over the thinking. Read the opening lesson, explore a practical workflow, and try the narration controls.</p>
            <div className="course-preview-proof"><span><Icon name="check" size={14}/> Real lesson, no signup</span><span><Icon name="headphones" size={14}/> Read or listen</span></div>
            <a className="text-link" href="/course/ai-powered-developer-productivity">Explore the full course <Icon name="arrow" size={15}/></a>
          </div>
          <a className="course-preview-card" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer" aria-label="Open the free preview: The AI-Assisted Developer">
            <span className="course-preview-card-top"><span className="course-preview-card-label"><Icon name="book" size={14}/> CHAPTER 01</span><span className="course-preview-free">FREE</span></span>
            <span className="course-preview-window"><span className="course-preview-window-bar"><i/><i/><i/><span>BRIANE-DEV / COURSE PLAYER</span></span><span className="course-preview-window-content"><span className="eyebrow">AI-POWERED DEVELOPER PRODUCTIVITY</span><strong>The AI-Assisted Developer</strong><span className="course-preview-play"><Icon name="play" size={19}/></span></span><span className="course-preview-progress"><i/></span></span>
            <span className="course-preview-card-action">Step inside the lesson <Icon name="arrow" size={14}/></span>
          </a>
        </section>

        <section id="curriculum" className="curriculum-section section-wrap section-block">
          <div className="course-name">{curriculum.title}</div>
          <SectionHeading eyebrow="CURRICULUM / PROGRESSION" title={<>{curriculum.sections.length} Sections <span>·</span> {totalChapters} Chapters</>} description="A structured path for using AI effectively throughout the software development lifecycle." action={<a className="text-link" href="#courses">Course content <Icon name="arrow" size={15}/></a>}/>
          <div className="curriculum-grid">{curriculum.sections.map((section) => <CurriculumCard section={section} key={section.id}/>)}</div>
          <div className="curriculum-footer"><span><span className="status-dot green-dot"/> WRITTEN LESSONS · CODE EXAMPLES · AI WORKFLOWS</span><span>{totalChapters} APPROVED CHAPTERS</span></div>
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
        <section id="pricing" className="pricing-section section-wrap section-block"><div className="center-heading"><span className="eyebrow">ACCESS / ENROLLMENT</span><h2>Individual Course Access</h2><p>Pay first, then create your learner account with the same email address.</p></div>{paymentReturn && <div className={`payment-message payment-message-${paymentReturn.state}`} role={paymentReturn.state === 'error' ? 'alert' : 'status'}>{paymentReturn.message}{paymentReturn.state !== 'confirmed' && <button type="button" className="payment-retry" onClick={() => verifyPaymentReturn(paymentReturn.reference)} disabled={paymentReturn.state === 'checking'}>{paymentReturn.state === 'checking' ? 'Checking…' : 'Retry verification'}</button>}{paymentReturn.state === 'confirmed' && <a className="button button-primary" href="/learn/register">Create your learner account</a>}</div>}<div className="pricing-grid">{regionalPrice ? <div className="pricing-checkout"><label>Email for course access<input type="email" value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com"/></label><PricingCard item={{...regionalPrice, action:'Pay and continue'}} selected busy={paymentBusy} error={pricingError} onSelect={purchaseCourse}/></div> : <p className="pricing-error" role="alert">{pricingError || 'Loading current Nigerian pricing…'}</p>}</div><p className="pricing-note"><Icon name="lock" size={13}/> Pay securely with Paystack. Available to customers in Nigeria. <span>·</span> Course access <span>·</span> Written lessons <span>·</span> AI prompts and workflows <span>·</span> TTS narration</p></section>

        <section id="faq" className="faq-section section-wrap section-block"><div className="center-heading"><span className="eyebrow">FAQ</span><h2>Frequently Asked Inquiries</h2><p>Clear answers about the curriculum, learning format, and access.</p></div><FaqList items={questions} openIndex={openFaq} onToggle={setOpenFaq}/></section>

        <section className="final-cta"><div><span className="eyebrow">AI-POWERED DEVELOPER PRODUCTIVITY</span><h2>Use AI Throughout<br/>the Software Lifecycle.</h2><p>Study practical AI workflows for planning, debugging, refactoring, documentation, testing, and delivery.</p><div className="hero-actions"><a className="button button-primary" href="#curriculum">View the Curriculum <Icon name="arrow" size={15}/></a><a className="button button-secondary" href="#courses">Explore Course Content</a></div></div></section>
      </main>

      <footer className="site-footer section-wrap"><Brand/><span>ENGINEERING EDUCATION / BUILT FOR THE SOFTWARE LIFECYCLE</span><div><a href="#curriculum">CURRICULUM</a><a href="#preview">FREE PREVIEW</a><a href="#pricing">ACCESS</a><a href="#faq">SUPPORT</a></div><span>© 2026 BRIANE-DEV</span></footer>
      <nav className="mobile-dock" aria-label="Quick navigation"><a href="#top"><Icon name="grid" size={17}/><span>HOME</span></a><a href="#curriculum"><Icon name="book" size={17}/><span>CURRICULUM</span></a><a href="#preview"><Icon name="code" size={17}/><span>PREVIEW</span></a><a href="#pricing"><Icon name="lock" size={17}/><span>ACCESS</span></a></nav>
    </div>
  )
}

function MotionPage({ children }) {
  useLayoutEffect(() => {
    if ((typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || typeof window.IntersectionObserver !== 'function') return undefined
    const sections = []
    document.querySelectorAll?.('.section-block, .feature-band, .home-services, .final-cta, .course-detail-page, .business-hero, .business-services, .business-process, .privacy-content')?.forEach((section) => sections.push(section))
    if (!sections.length) return undefined
    let observer
    try {
      observer = new window.IntersectionObserver((entries, activeObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('whip-section-visible')
          activeObserver.unobserve(entry.target)
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      sections.forEach((section, index) => {
        section.classList.add('whip-section')
        if (index % 2 === 1) section.classList.add('whip-from-right')
        observer.observe(section)
      })
    } catch {
      observer?.disconnect()
      sections.forEach((section) => section.classList.add('whip-section-visible'))
    }
    return () => observer?.disconnect()
  }, [])
  return children
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  let page
  if (path === '/super-admin') page = <AdminLogin />
  else if (path === '/services') page = <><PublicPageMetadata path={path}/><BusinessPages page="services" /></>
  else if (path === '/privacy') page = <><PublicPageMetadata path={path}/><BusinessPages page="privacy" /></>
  else if (path === '/course/ai-powered-developer-productivity') page = <CoursePage />
  else if (path === '/contact') page = <BusinessPages page="contact" />
  else if (path === '/quote') page = <BusinessPages page="quote" />
  else if (path === '/admin' || path.startsWith('/admin/')) page = <AdminDashboard />
  else if (path === '/learn/login') page = <LearnerLogin />
  else if (path === '/learn/register') page = <LearnerRegister />
  else if (path === '/learn/forgot-password') page = <PasswordRecovery />
  else if (path === '/learn/reset-password') page = <PasswordRecovery reset />
  else if (path === '/learn') page = <LearnerDashboard />
  else if (/^\/courses\/[^/]+\/learn\/chapter-[a-z0-9-]+$/.test(path)) page = <CourseReader />
  else page = <LandingPage />
  return <MotionPage>{page}</MotionPage>
}

export default App

const pageDescriptions = {
  '/privacy': ['BrianE-Dev Privacy Policy', 'Learn how BrianE-Dev handles learner account, course, payment, progress, certificate, and enquiry information.'],
  '/services': ['Digital Services | BrianE-Dev', 'Explore BrianE-Dev website, e-commerce, web application, and integration services.'],
  '/course/ai-powered-developer-productivity': ['AI-Powered Developer Productivity Course | BrianE-Dev', 'Learn AI-powered developer workflows, coding with AI, debugging strategies and practical techniques to improve software engineering productivity with BrianE-Dev.'],
}

function setPageMetadata(path, title, description) {
  document.title = title
  const set = (selector, attribute, value) => { const element = document.querySelector(selector); if (element) element.setAttribute(attribute, value) }
  set('meta[name="description"]', 'content', description)
  set('link[rel="canonical"]', 'href', `https://briane-dev.online${path === '/' ? '/' : path}`)
  set('meta[property="og:title"]', 'content', title)
  set('meta[property="og:description"]', 'content', description)
  set('meta[property="og:url"]', 'content', `https://briane-dev.online${path === '/' ? '/' : path}`)
}

function PublicPageMetadata({ path }) {
  useEffect(() => {
    const [title, description] = pageDescriptions[path]
    setPageMetadata(path, title, description)
  }, [path])
  return null
}

function PublicCourseStructuredData() {
  useEffect(() => {
    if (document.getElementById('course-structured-data')) return undefined
    const script = document.createElement('script')
    script.id = 'course-structured-data'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(courseStructuredData)
    document.head.appendChild(script)
    return () => script.remove()
  }, [])
  return null
}

function CoursePage() {
  return <><PublicCourseStructuredData/><LandingPage metadataPath="/course/ai-powered-developer-productivity" isCourseLanding><section className="course-detail-page section-wrap"><span className="eyebrow">BRIANE-DEV / FLAGSHIP COURSE</span><h2>Practical AI workflows for software engineers</h2><p>Learn how to integrate AI into software planning, coding, debugging, testing, documentation, and delivery. Written instruction and code-focused examples explain the workflow and the engineering reasoning behind it.</p><h2>Learning outcomes</h2><ul><li>Choose AI tools and apply them responsibly to software work.</li><li>Turn requirements into user flows, architecture choices, roadmaps, and implementation tasks.</li><li>Use AI while building frontend and backend features, working with databases, and integrating APIs.</li><li>Investigate errors, debug complex problems, and strengthen tests and quality checks.</li><li>Review code, document decisions, consider security, and maintain AI-assisted codebases.</li><li>Combine the methods into a practical developer workflow.</li></ul><h2>Course topics</h2><ul>{curriculum.sections.map((section) => <li key={section.id}><strong>{section.title}:</strong> {section.description}</li>)}</ul><p>The curriculum contains {curriculum.sections.length} sections and {totalChapters} chapters. Chapter 1 is available as a free preview. Full course access is paid through Paystack for customers in Nigeria; the current configured price and any active promotion appear in the enrollment section. Certificate eligibility follows purchase and completion of required course activities.</p><div className="hero-actions"><a className="button button-primary" href="/#pricing">Explore enrollment</a><a className="button button-secondary" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">Read the free Chapter 1 preview</a></div><p><a className="text-link" href="/privacy">Read the BrianE-Dev Privacy Policy</a></p></section></LandingPage></>
}
