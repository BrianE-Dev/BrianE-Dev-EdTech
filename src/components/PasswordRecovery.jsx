import { useState } from 'react'
import Brand from './Brand.jsx'
import { api } from '../services/api.js'

export default function PasswordRecovery({ reset = false }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await api(reset ? '/auth/reset-password' : '/auth/forgot-password', { method: 'POST', body: JSON.stringify(reset ? { token: form.get('token'), password: form.get('password'), confirmPassword: form.get('confirmPassword') } : { email: form.get('email') }) })
      setResult(response)
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <main className="learner-auth-page"><header><a href="/"><Brand /></a><a href="/learn/login">Sign in</a></header><section className="learner-auth-card"><span className="eyebrow">ACCOUNT SECURITY</span><h1>{reset ? 'Set a new password' : 'Recover your password'}</h1><p>{reset ? 'Choose a new password for your account.' : 'Enter your account email. The response is the same whether the address is registered or not.'}</p>
    {result?.developmentResetToken && <p className="learner-error">Mail is not configured. Local reset token: <code>{result.developmentResetToken}</code> <a href={`/learn/reset-password?token=${encodeURIComponent(result.developmentResetToken)}`}>Continue reset</a></p>}
    {result?.ok && !result.developmentResetToken && <p role="status">If an eligible account exists, recovery instructions will be sent when email delivery is configured.</p>}
    {result?.message && <p role="status">{result.message} <a href="/learn/login">Sign in</a></p>}
    <form onSubmit={submit}>{reset ? <><label>Reset token<input name="token" required defaultValue={new URLSearchParams(window.location.search).get('token') || ''} /></label><label>New password<input name="password" type="password" minLength="10" maxLength="128" required /></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="10" maxLength="128" required /></label></> : <label>Email address<input name="email" type="email" required /></label>}{error && <p className="learner-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : reset ? 'Update password' : 'Send recovery instructions'}</button></form>
  </section></main>
}
