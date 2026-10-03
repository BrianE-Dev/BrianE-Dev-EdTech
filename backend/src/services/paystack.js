const baseUrl = 'https://api.paystack.co'

async function request(path, options = {}) {
  if (!process.env.PAYSTACK_SECRET_KEY) throw Object.assign(new Error('Paystack is not configured'), { status: 503 })
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...options.headers },
  })
  const payload = await response.json()
  if (!response.ok || !payload.status) throw Object.assign(new Error(payload.message || 'Paystack request failed'), { status: 502 })
  return payload.data
}

export const initializeTransaction = (body) => request('/transaction/initialize', { method: 'POST', body: JSON.stringify(body) })
export const verifyTransaction = (reference) => request(`/transaction/verify/${encodeURIComponent(reference)}`)
