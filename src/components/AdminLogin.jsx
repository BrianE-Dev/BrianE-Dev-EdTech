import { useState } from 'react'
import Brand from './Brand.jsx'
import { api } from '../services/api.js'

export default function AdminLogin() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).has('denied') ? 'This account does not have Super Admin access.' : '')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      if (user.role !== 'super_admin') {
        await api('/auth/logout', { method: 'POST' })
        setError('This account does not have Super Admin access.')
        return
      }
      window.location.assign('/admin')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="admin-auth-page">
    <header><a href="/" aria-label="BrianE-Dev homepage"><Brand /></a><span className="eyebrow">SECURE ADMIN ACCESS</span></header>
    <section className="admin-auth-card">
      <span className="eyebrow">BRIANE-DEV / COMMERCE</span>
      <h1>Super Admin sign in</h1>
      <p>Sign in with the administrator account configured for this application.</p>
      <form onSubmit={submit}>
        <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button>
      </form>
      <a className="admin-back-link" href="/">Back to BrianE-Dev</a>
    </section>
    <footer>ADMINISTRATIVE ACCESS IS RESTRICTED TO AUTHORIZED ACCOUNTS</footer>
  </main>
}
