import { useEffect, useState } from 'react'
import Brand from './Brand.jsx'
import { api } from '../services/api.js'

export default function EmailVerification() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '')
  const [state, setState] = useState(token ? 'checking' : 'invalid')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token) return undefined
    window.history.replaceState({}, '', window.location.pathname)
    let active = true
    api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => { if (active) { setState('success'); setMessage('Your email address is verified. Sign in to complete course payment and open your dashboard after purchase.') } })
      .catch((error) => { if (active) { setState('invalid'); setMessage(error.message || 'This verification link is invalid or expired.') } })
    return () => { active = false }
  }, [token])

  async function resend(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) })
      setResent(true)
      setMessage(result.message)
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <main className="learner-auth-page"><header><a href="/"><Brand /></a><a href="/learn/login">Sign in</a></header><section className="learner-auth-card">
    <span className="eyebrow">ACCOUNT SECURITY</span>
    <h1>{state === 'checking' ? 'Verifying your email' : state === 'success' ? 'Email verified' : 'Verification link unavailable'}</h1>
    {state === 'checking' ? <p role="status">Checking your verification link…</p> : <p role={state === 'invalid' ? 'alert' : 'status'}>{message || 'Check your inbox and Spam/Junk folder for the latest verification email, or request a new link below.'}</p>}
    {state !== 'success' && <form onSubmit={resend}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><button className="button button-primary" disabled={busy || resent}>{busy ? 'Sending…' : resent ? 'Request received' : 'Send a new verification link'}</button></form>}
    <p className="learner-auth-switch"><a href="/learn/login">Return to sign in</a></p>
  </section></main>
}
