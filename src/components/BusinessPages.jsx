import { useEffect, useState } from 'react'
import Brand from './Brand.jsx'
import SiteNavigation from './SiteNavigation.jsx'
import { api } from '../services/api.js'

const services = [
  ['Business websites', 'A clear, credible website that helps customers understand your offer and take the next step.'],
  ['E-commerce', 'Product catalogues and checkout experiences designed around your operations and customers.'],
  ['Landing pages', 'Focused campaign pages with a direct message, useful content, and a clear call to action.'],
  ['Custom web applications', 'Purpose-built tools for workflows that do not fit a standard off-the-shelf product.'],
  ['SaaS platforms', 'Web product foundations, account flows, and integrations planned around your service.'],
  ['Redesign and support', 'Improve an existing site, connect APIs, or keep your web product maintained.'],
]

function PrivacyPolicy() {
  return <><section className="business-hero compact"><span className="eyebrow">BRIANE-DEV / PRIVACY / UPDATED 20 OCTOBER 2026</span><h1>Privacy Policy</h1><p>BrianE-Dev is the property of Chukwuemeka Nkama. This policy explains personal information handled when you use the learning platform, make a course purchase, request support, or submit a business enquiry.</p></section><article className="privacy-content"><h2>Information and purposes</h2><p>Depending on how you use the service, we handle learner name and email, password hash, email-verification and security records, optional profile details, course access and progress, assessment attempts, required exercise acknowledgements, certificate eligibility and issuance, payment references and transaction status, enquiry details, and technical diagnostics. Passwords are stored as hashes. Checkout email can be used to match confirmed payment when an account is created. We use this information to manage accounts, confirm payment, provide learning access, track progress, assess certificate eligibility, respond to requests, protect the service, and meet applicable record-keeping duties.</p><h2>Payments and service providers</h2><p>Paystack processes checkout and payment details. The application stores references, transaction status, amount and currency snapshots, and related course records; it does not collect or store complete card details. MongoDB stores account, course, payment, progress, and operational records. The website and API use hosting providers. Configured narration generation may send course lesson text to Google Gemini; it is not a user prompt feature. Production audio uses configured S3-compatible object storage. No analytics or advertising tracking scripts are added by this app.</p><h2>Cookies and security</h2><p>Signed-in sessions use a cookie named <code>session</code>. It is HttpOnly, path-wide, and expires after seven days; the API configures Secure for HTTPS and SameSite based on deployment mode. Theme preference is stored in browser local storage. We use application access controls, but no internet service can guarantee absolute security.</p><h2>Retention and your choices</h2><p>We retain account, learning, certificate, payment, and enquiry records while needed to provide the service, maintain security and payment reconciliation, and meet legal obligations. Periods depend on record type and applicable requirements. Email <a href="mailto:info@briane-dev.online">info@briane-dev.online</a> to request access to, correction of, or deletion of personal information. Requests are reviewed, subject to identity checks and records that must be retained. Business enquiry contacts are not added to marketing email without separate opt-in.</p><h2>Age, changes, and applicable rules</h2><p>The platform is a professional learning service and is not designed to collect information from children. No minimum age is stated here; eligibility is subject to applicable law. Policy updates will be reflected here. BrianE-Dev aims to handle personal information consistently with applicable privacy requirements, including Nigerian data-protection law where relevant; this notice is not legal advice or a claim of formal certification.</p><h2>Contact and ownership</h2><p>For privacy requests or questions, contact <a href="mailto:info@briane-dev.online">info@briane-dev.online</a>. BrianE-Dev is the property of Chukwuemeka Nkama.</p></article></>
}

export default function BusinessPages({ page }) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('briane-dev-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('briane-dev-theme', theme)
  }, [theme])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setResult(null)
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    body.privacyAccepted = form.has('privacyAccepted')
    body.marketingConsent = form.has('marketingConsent')
    if (page === 'quote') body.requiredFeatures = String(form.get('requiredFeatures') || '').split(',').map((item) => item.trim()).filter(Boolean)
    try { setResult(await api(`/business/${page === 'quote' ? 'quotes' : 'enquiries'}`, { method: 'POST', body: JSON.stringify(body) })); event.currentTarget.reset() }
    catch (error) { setResult({ error: error.message }) }
    finally { setBusy(false) }
  }
  return <main className="business-page">
    <SiteNavigation theme={theme} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}/>
    {page === 'privacy' ? <PrivacyPolicy /> : page === 'services' ? <>


      <section className="business-hero"><span className="eyebrow">BRIANE-DEV / DIGITAL PRODUCTS</span><h1>Build a better digital experience for your business.</h1><p>Websites, applications, and integrations shaped around what your business needs to do.</p><a className="button button-primary" href="/quote">Request a Quote</a></section>
      <section className="business-services">{services.map(([title, description]) => <article key={title}><span className="eyebrow">DIGITAL SERVICES</span><h2>{title}</h2><p>{description}</p><a href="/quote">Discuss this service →</a></article>)}</section>
      <section className="business-process"><span className="eyebrow">A CLEAR PROCESS</span><h2>From first conversation to launch.</h2><p>We learn about your goals, agree on a practical scope, build in visible steps, and prepare the work for handover and ongoing support.</p><a className="button button-primary" href="/contact">Discuss your project</a></section>
    </> : <>
      <section className="business-hero compact"><span className="eyebrow">BRIANE-DEV / {page === 'quote' ? 'PROJECT BRIEF' : 'CONTACT'}</span><h1>{page === 'quote' ? 'Tell us what you are planning.' : 'Start a conversation.'}</h1><p>{page === 'quote' ? 'Share the essentials and we will have a useful starting point for a discussion.' : 'Send a note about your project, question, or business need.'}</p>{page === 'contact' && <a className="button button-primary" href="/quote">Request a Quote</a>}</section>
      <form className="business-form" onSubmit={submit}>
        {result?.reference ? <div className="business-result" role="status"><strong>Request saved.</strong><span>Your reference is {result.reference}. Email acknowledgement is currently unavailable.</span></div> : result?.error && <div className="business-error" role="alert">{result.error}</div>}
        <label>Full name<input name="name" required minLength="2" maxLength="120" autoComplete="name" /></label>
        <label>Email address<input name="email" type="email" required maxLength="254" autoComplete="email" /></label>
        <label>Phone number <span>(optional)</span><input name="phone" maxLength="40" autoComplete="tel" /></label>
        <label>Company <span>(optional)</span><input name="company" maxLength="160" autoComplete="organization" /></label>
        {page === 'quote' ? <>
          <label>Project type<select name="projectType" required defaultValue=""><option value="" disabled>Select a service</option>{services.map(([name]) => <option key={name}>{name}</option>)}</select></label>
          <label>Required features <span>(comma separated)</span><input name="requiredFeatures" maxLength="1000" /></label>
          <label>Estimated budget<select name="budget" defaultValue=""><option value="">Choose a range</option><option>Under $1,000</option><option>$1,000–$5,000</option><option>$5,000–$15,000</option><option>$15,000+</option><option>Not sure yet</option></select></label>
          <label>Preferred timeline<select name="timeline" defaultValue=""><option value="">Choose a timeline</option><option>Within a month</option><option>1–3 months</option><option>3–6 months</option><option>Flexible</option></select></label>
          <label>Existing website <span>(optional)</span><input name="website" type="url" maxLength="300" placeholder="https://" /></label>
        </> : <label>Subject<input name="subject" required maxLength="160" /></label>}
        <label className="wide">{page === 'quote' ? 'Project description' : 'Message'}<textarea name="message" required minLength="10" maxLength="5000" rows="6" /></label>
        {page === 'quote' && <label className="wide">Additional notes <span>(optional)</span><textarea name="notes" maxLength="3000" rows="3" /></label>}
        <label className="business-check wide"><input type="checkbox" name="privacyAccepted" required /> I acknowledge the <a href="/privacy">privacy notice</a> for handling this request.</label>
        {page === 'quote' && <label className="business-check wide"><input type="checkbox" name="marketingConsent" /> I would like to receive occasional product and service updates by email.</label>}
        <button className="button button-primary wide" disabled={busy}>{busy ? 'Sending…' : page === 'quote' ? 'Submit project request' : 'Send message'}</button>
      </form>
    </>}
    <footer className="business-footer"><Brand /><span>Digital products and software development / BrianE-Dev<br/>Property of Chukwuemeka Nkama.</span><a href="/privacy">Privacy Policy</a><a href="/">Explore developer education</a><span>© {new Date().getFullYear()} BrianE-Dev</span></footer>


  </main>
}
