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
    {page === 'privacy' ? <section className="business-hero compact"><span className="eyebrow">BRIANE-DEV / PRIVACY</span><h1>How project enquiries are handled.</h1><p>We use the details submitted here to respond to your enquiry, assess the project request, and maintain a record for follow-up. We do not add quote request contacts to marketing email unless you separately opt in. You can request correction or deletion by contacting info@briane-dev.online.</p></section> : page === 'services' ? <>
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
    <footer className="business-footer"><Brand /><span>Digital products and software development / BrianE-Dev</span><a href="/">Explore developer education</a></footer>
  </main>
}
