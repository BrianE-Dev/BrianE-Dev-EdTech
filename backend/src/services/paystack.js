import { getPaystackConfig } from '../config/paystack.js'

async function request(path, options = {}) {
  const config = getPaystackConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/json', ...options.headers },
  })
  const payload = await response.json()
  if (!response.ok || !payload.status) throw Object.assign(new Error(payload.message || 'Paystack request failed'), { status: 502 })
  return payload.data
}

export const initializeTransaction = (body) => request('/transaction/initialize', { method: 'POST', body: JSON.stringify(body) })
export const verifyTransaction = (reference) => request(`/transaction/verify/${encodeURIComponent(reference)}`)
