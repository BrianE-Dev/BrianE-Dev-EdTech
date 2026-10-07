import { useState } from 'react'
import Brand from '../Brand.jsx'
import { registerLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return value === '/#pricing' || (typeof value === 'string' && /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerRegister() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const { user } = await registerLearner(form.get('name'), form.get('email'), form.get('password'))
      window.location.assign(user.role === 'super_admin' ? '/admin' : returnTo)
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
      <form onSubmit={submit}>
        <label>Name<input type="text" name="name" autoComplete="name" minLength="2" maxLength="120" required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength="10" maxLength="128" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="learner-auth-switch">Already registered? <a href={`/learn/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
    </section>
  </main>
}
