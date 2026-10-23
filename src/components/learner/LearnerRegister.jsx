import { useState } from 'react'
import Brand from '../Brand.jsx'
import { api, registerLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return typeof value === 'string' && (/^\/#pricing(?:[?].*)?$/.test(value) || /^\/pricing(?:[/?#]|$)/.test(value) || /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerRegister() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const email = String(form.get('email') || '').trim().toLowerCase()
      const password = String(form.get('password') || '')
      const confirmPassword = String(form.get('confirmPassword') || '')
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      const result = await registerLearner(form.get('name'), email, password, confirmPassword)
      const delivery = ['accepted', 'failed', 'not_configured'].includes(result?.emailDelivery?.state) ? result.emailDelivery.state : 'unknown'
      setRegistration({ email, delivery })
      try { sessionStorage.setItem('briane-dev-registration-notice', JSON.stringify({ email, delivery })) } catch { /* Registration confirmation remains visible on this page. */ }
    } catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  async function resendVerification() {
    if (!registration?.email) return
    setResending(true)
    setResendMessage('')
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: registration.email }) })
      setResendMessage(result?.message || 'If the account needs verification, a new link will be sent.')
    } catch (requestError) {
      setResendMessage(requestError.message || 'The request could not be completed. Please try again later.')
    } finally { setResending(false) }
  }

  return <main className="learner-auth-page">
    <header>
      <a href="/" aria-label="BrianE-Dev homepage"><Brand /></a>
      <a href="/super-admin">Super Admin sign in</a>
    </header>
    <section className="learner-auth-card">
      <span className="eyebrow">BRIANE-DEV / LEARNER ACCESS</span>
      <h1>Create your learner account</h1>
      {registration ? <div className="payment-message" role="status">
        <strong>Account created for {registration.email}.</strong>
        <p>{registration.delivery === 'accepted'
          ? 'Your verification email is on its way. Check your inbox and Spam/Junk folder; delivery may take a few minutes.'
          : registration.delivery === 'failed' || registration.delivery === 'not_configured'
            ? 'Your account was created, but the verification email could not be sent. You do not need to register again; use the button below to request another link.'
            : 'Your account request was received, but the email status was unclear. Check your inbox and Spam/Junk folder, or request another link below.'}</p>
        <button className="button button-secondary" type="button" onClick={resendVerification} disabled={resending}>{resending ? 'Requesting…' : 'Resend verification email'}</button>
        {resendMessage && <p>{resendMessage}</p>}
        <p><a href="/learn/login">Continue to sign in</a></p>
      </div> : <p>Create your account first so you can verify your email. After verification, sign in to complete payment and unlock the course dashboard.</p>}
      {!registration && <form onSubmit={submit}>
        <label>Name<input type="text" name="name" autoComplete="name" minLength="2" maxLength="120" required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength="8" maxLength="128" required /></label>
        <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" minLength="8" maxLength="128" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>}
      <p className="learner-auth-switch">Already registered? <a href={`/learn/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
    </section>
  </main>
}
