import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

export function diagnosticTokenMatches(providedToken, expectedToken) {
  if (typeof expectedToken !== 'string' || Buffer.byteLength(expectedToken) < 32) return false
  if (typeof providedToken !== 'string') return false
  const expected = Buffer.from(expectedToken)
  const provided = Buffer.from(providedToken)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function getOutboundPublicIp(fetchImpl = fetch) {
  const response = await fetchImpl('https://api.ipify.org?format=json', {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error('IP check service returned a non-success status')
  const body = await response.json()
  if (typeof body?.ip !== 'string' || !isIP(body.ip)) throw new Error('IP check service returned an invalid address')
  return body.ip
}
