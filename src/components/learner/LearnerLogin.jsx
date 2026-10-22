import { useState } from 'react'
import Brand from '../Brand.jsx'
import { api, getPurchases, loginLearner } from '../../services/api.js'

function safeReturnPath(value) {
  return typeof value === 'string' && (/^\/#pricing(?:[?].*)?$/.test(value) || /^\/pricing(?:[/?#]|$)/.test(value) || /^\/(learn|courses\/[^/]+\/learn\/chapter-[a-z0-9-]+)(?:[/?#]|$)/.test(value)) ? value : '/learn'
}

export default function LearnerLogin() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationNotice, setVerificationNotice] = useState('')
  const [resending, setResending] = useState(false)
  const [notice] = useState(() => new URLSearchParams(window.location.search).get('created') === '1' ? 'If your account was created, verify your email before signing in. Check your inbox and Spam/Junk folder, or request another link below.' : '')
  const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const { user } = await loginLearner(form.get('email'), form.get('password'))
      if (user.role === 'super_admin') {
        window.location.assign('/admin')
        return
      }
      const purchases = await getPurchases()
      const destination = purchases.length
        ? (returnTo === '/pricing' || returnTo === '/#pricing' ? '/learn' : returnTo)
        : (returnTo !== '/learn' && returnTo !== '/pricing' ? returnTo : '/pricing')
      window.location.assign(destination)
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.code === 'EMAIL_VERIFICATION_REQUIRED') setVerificationEmail(String(form.get('email') || ''))
    } finally {
      setBusy(false)
    }
  }

  return <main className="learner-auth-page">
    <header><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><a href="/super-admin">Super Admin sign in</a></header>
    <section className="learner-auth-card">
      <span className="eyebrow">BRIANE-DEV / LEARNER ACCESS</span>
      <h1>Welcome back</h1>
      <p>Sign in to continue your course. Paid course access is checked securely by the server.</p>
      <form onSubmit={submit}>
        {notice && <div className="learner-error" role="status"><strong>{notice}</strong></div>}
        <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        {error && <p className="learner-error" role="alert">{error}</p>}
        {verificationEmail && <div className="learner-error" role="status"><strong>Verify your email before signing in.</strong><p className="learner-verification-hint">Check your inbox and Spam/Junk folder. If you can’t find the message, request a new verification link below.</p><button type="button" className="button button-primary" disabled={resending} onClick={async () => { setResending(true); setVerificationNotice(''); try { const result = await api('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: verificationEmail }) }); setVerificationNotice(result.message) } catch (resendError) { setVerificationNotice(resendError.message) } finally { setResending(false) } }}>{resending ? 'Sending…' : 'Resend verification email'}</button>{verificationNotice && <p role="status">{verificationNotice}</p>}</div>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="learner-auth-switch"><a href="/learn/forgot-password">Forgot your password?</a></p>
      <p className="learner-auth-switch">New to BrianE-Dev? <a href={`/learn/register?returnTo=${encodeURIComponent(returnTo)}`}>Create your learner account</a></p>
      <a className="admin-back-link" href="/">Back to BrianE-Dev</a>
    </section>
  </main>
}
