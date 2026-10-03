const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(body?.error || 'Request failed')
  return body
}
