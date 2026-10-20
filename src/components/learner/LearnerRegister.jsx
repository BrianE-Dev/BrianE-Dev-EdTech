import { useState } from 'react'
import Brand from '../Brand.jsx'
import { api, registerLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return typeof value === 'string' && (/^\/#pricing(?:[?].*)?$/.test(value) || /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerRegister() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await registerLearner(form.get('name'), form.get('email'), form.get('password'))
      setPending({ email: form.get('email'), token: result.developmentVerificationToken || '' })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="learner-auth-page">
    <header><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><a href="/super-admin">Super Admin sign in</a></header>
    <section className="learner-auth-card">
      <span className="eyebrow">BRIANE-DEV / LEARNER ACCESS</span>
      <h1>Create your learner account</h1>
      <p>Create your free BrianE-Dev account to access the course preview. Purchase the course to unlock the complete 43-chapter learning experience.</p>
      {pending && <div className="learner-error" role="status"><strong>Verify your email to continue.</strong><p>Protected course features remain locked until verification succeeds. Mail delivery is currently unavailable.</p>{pending.token ? <button type="button" className="button button-primary" onClick={async () => { try { await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: pending.token }) }); window.location.assign(`/learn/login?returnTo=${encodeURIComponent(returnTo)}&verified=1`) } catch (verifyError) { setError(verifyError.message) } }}>Verify this development account</button> : <p>Resend verification after email delivery has been configured.</p>}</div>}
      <form onSubmit={submit}>
        <label>Name<input type="text" name="name" autoComplete="name" minLength="2" maxLength="120" required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength="10" maxLength="128" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy || Boolean(pending)}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="learner-auth-switch">Already registered? <a href={`/learn/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
    </section>
  </main>
}
