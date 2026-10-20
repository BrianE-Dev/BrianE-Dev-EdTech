import { useEffect, useState } from 'react'
import Brand from '../Brand.jsx'
import { api, registerLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return typeof value === 'string' && (/^\/#pricing(?:[?].*)?$/.test(value) || /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerRegister() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paymentReady, setPaymentReady] = useState(false)
  const [reference] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('reference') || params.get('trxref') || sessionStorage.getItem('briane-dev-paid-reference')
  })
  const [checkingPayment, setCheckingPayment] = useState(() => Boolean(reference))
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  useEffect(() => {
    if (!reference) return
    api('/brianedev/payments/verify-public', { method: 'POST', body: JSON.stringify({ reference }) })
      .then((result) => setPaymentReady(result.status === 'paid'))
      .catch(() => setPaymentReady(false))
      .finally(() => { setCheckingPayment(false); window.history.replaceState({}, '', window.location.pathname) })
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await registerLearner(form.get('name'), form.get('email'), form.get('password'))
      sessionStorage.removeItem('briane-dev-paid-reference')
      window.location.assign(`/learn/login?returnTo=${encodeURIComponent(returnTo)}&created=1`)
    } catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  return <main className="learner-auth-page">
    <header><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><a href="/super-admin">Super Admin sign in</a></header>
    <section className="learner-auth-card">
      <span className="eyebrow">BRIANE-DEV / LEARNER ACCESS</span>
      <h1>Create your learner account</h1>
      <p>Complete course payment with this email address first. Once payment succeeds, create your account to enter the full 43-chapter learning space.</p>
      {checkingPayment && <p role="status">Verifying your payment…</p>}
      {!checkingPayment && !paymentReady && <div className="learner-error" role="status"><strong>Payment required before signup.</strong><p>Pay for the course using the same email address, then return here to create your account.</p><a className="button button-primary" href="/#pricing">Go to course payment</a></div>}
      {paymentReady && <form onSubmit={submit}>
        <label>Name<input type="text" name="name" autoComplete="name" minLength="2" maxLength="120" required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength="10" maxLength="128" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>}
      <p className="learner-auth-switch">Already registered? <a href={`/learn/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
    </section>
  </main>
}
