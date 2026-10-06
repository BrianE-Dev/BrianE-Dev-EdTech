import { useState } from 'react'
import Brand from '../Brand.jsx'
import { loginLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return value === '/#pricing' || (typeof value === 'string' && /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerLogin() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const { user } = await loginLearner(form.get('email'), form.get('password'))
      window.location.assign(user.role === 'super_admin' ? '/admin' : returnTo)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="learner-auth-page">
    <header><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><a href="/login">Super Admin sign in</a></header>
    <section className="learner-auth-card">
      <span className="eyebrow">BRIANE-DEV / LEARNER ACCESS</span>
      <h1>Welcome back</h1>
      <p>Sign in to continue your course. Paid course access is checked securely by the server.</p>
      <form onSubmit={submit}>
        <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="learner-auth-switch">New to BrianE-Dev? <a href={`/learn/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</a></p>
      <a className="admin-back-link" href="/">Back to BrianE-Dev</a>
    </section>
  </main>
}
