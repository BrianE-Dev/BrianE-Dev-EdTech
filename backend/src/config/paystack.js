const KNOWN_KEY_PREFIXES = {
  public: { test: 'pk_test_', live: 'pk_live_' },
  secret: { test: 'sk_test_', live: 'sk_live_' },
}

function validateKeyEnvironment(name, value, type, appEnvironment) {
  const prefixes = KNOWN_KEY_PREFIXES[type]
  const detectedEnvironment = Object.entries(prefixes).find(([, prefix]) => value.startsWith(prefix))?.[0]
  if (detectedEnvironment && detectedEnvironment !== (appEnvironment === 'production' ? 'live' : 'test')) {
    throw new Error(`${name} key prefix does not match APP_ENV=${appEnvironment}; use ${appEnvironment === 'production' ? 'live' : 'test'} credentials`)
  }
}

export function getPaystackConfig(env = process.env) {
  const appEnvironment = env.APP_ENV || 'development'
  if (!['development', 'production'].includes(appEnvironment)) {
    throw new Error('APP_ENV must be either development or production')
  }

  const required = ['PAYSTACK_PUBLIC_KEY', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_WEBHOOK_SECRET', 'PAYSTACK_BASE_URL']
  const missing = required.filter((name) => !env[name]?.trim())
  if (missing.length) throw new Error(`Missing Paystack configuration: ${missing.join(', ')}. Set these in backend/.env or the deployment environment.`)

  validateKeyEnvironment('PAYSTACK_PUBLIC_KEY', env.PAYSTACK_PUBLIC_KEY.trim(), 'public', appEnvironment)
  validateKeyEnvironment('PAYSTACK_SECRET_KEY', env.PAYSTACK_SECRET_KEY.trim(), 'secret', appEnvironment)

  let baseUrl
  try { baseUrl = new URL(env.PAYSTACK_BASE_URL) } catch { throw new Error('PAYSTACK_BASE_URL must be a valid HTTPS URL') }
  if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'api.paystack.co' || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
    throw new Error('PAYSTACK_BASE_URL must be https://api.paystack.co')
  }

  return Object.freeze({
    appEnvironment,
    publicKey: env.PAYSTACK_PUBLIC_KEY.trim(),
    secretKey: env.PAYSTACK_SECRET_KEY.trim(),
    webhookSecret: env.PAYSTACK_WEBHOOK_SECRET.trim(),
    baseUrl: baseUrl.origin,
  })
}
