import mongoose from 'mongoose'
import { runtimeLogPrefix } from './runtimeIdentity.js'

let connectionPromise
let databaseMonitor
let mongoConfigurationReported = false
const MAX_RETRY_DELAY_MS = 30_000
const DATABASE_CONNECTION_ERRORS = new Set([
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
])

const waitForRetry = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

function errorChain(root) {
  const queue = [root]
  const visited = new Set()
  const details = []

  while (queue.length && visited.size < 40) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || visited.has(current)) continue
    visited.add(current)

    const name = typeof current.name === 'string' ? current.name : null
    const code = typeof current.code === 'string' || typeof current.code === 'number'
      ? String(current.code)
      : typeof current.codeName === 'string' ? current.codeName : null
    const message = typeof current.message === 'string' ? current.message : ''
    const discoveredCodes = [...message.matchAll(/\b(ENOTFOUND|EAI_AGAIN|ETIMEOUT|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ERR_TLS_[A-Z0-9_]+|ERR_SSL_[A-Z0-9_]+|TLSV1_ALERT_[A-Z0-9_]+)\b/g)].map((match) => match[1])
    if (name || code || discoveredCodes.length) details.push({ name, code, discoveredCodes })

    for (const key of ['cause', 'reason', 'error', 'originalError']) {
      if (current[key] && current[key] !== current) queue.push(current[key])
    }
    if (Array.isArray(current.errors)) queue.push(...current.errors)
    if (current.servers instanceof Map) {
      for (const server of current.servers.values()) {
        if (server?.error) queue.push(server.error)
        if (server?.description?.error) queue.push(server.description.error)
      }
    }
  }

  return details
}

export function formatMongoConnectionError(error, uri = '') {
  let safeMessage = String(error?.message || error || 'unknown error')
  if (uri) safeMessage = safeMessage.replaceAll(uri, '[redacted MongoDB URI]')
  safeMessage = safeMessage
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, '[redacted MongoDB URI]')
    .replace(/\b(username|user|password|pwd)\b\s*(?:[:=]\s*|\s+)(?:"[^"]*"|'[^']*'|[^,\s;"'<>]+)/gi, '$1=[redacted]')
  const details = errorChain(error)
  const codes = [...new Set(details.flatMap(({ code, discoveredCodes }) => [code, ...discoveredCodes]).filter(Boolean))]
  const names = [...new Set(details.map(({ name }) => name).filter(Boolean))]
  const combined = `${safeMessage} ${names.join(' ')}`.toLowerCase()
  const likelyCauses = []

  if (codes.some((code) => ['ENOTFOUND', 'EAI_AGAIN'].includes(code)) || /srv|dns|enotfound|eai_again/.test(combined)) likelyCauses.push('DNS/SRV resolution')
  if (codes.some((code) => code.startsWith('ERR_SSL_') || code.startsWith('ERR_TLS_') || code.startsWith('TLSV1_ALERT_')) || /tls|ssl|certificate/.test(combined)) likelyCauses.push('TLS handshake or certificate negotiation')
  if (codes.some((code) => ['ETIMEDOUT', 'ETIMEOUT'].includes(code)) || /timed out|timeout/.test(combined)) likelyCauses.push('network timeout')
  if (/ip.{0,40}(?:not whitelisted|not allowed|access list)|whitelist.{0,40}ip/.test(combined)) {
    likelyCauses.push('Atlas IP access-list rejection indicated by the error')
  } else if (codes.some((code) => ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) || /networkerror|could not connect|not reachable/.test(combined)) {
    likelyCauses.push('network connectivity or Atlas IP access list; a generic timeout cannot distinguish them')
  }
  if (/authentication failed|auth failed|bad auth|authenticationerror/.test(combined) || details.some(({ code }) => code === '18' || code === 'AuthenticationFailed')) likelyCauses.push('authentication')
  if (!likelyCauses.length) likelyCauses.push('unclassified; inspect the sanitized error and nested codes')

  return `${safeMessage}; nested=${JSON.stringify(details)}; possibleCauses=${likelyCauses.join(', ')}`
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1
}

export function isDatabaseUnavailableError(error) {
  return DATABASE_CONNECTION_ERRORS.has(error?.name) || (!isDatabaseReady() && error?.name === 'MongooseError')
}

export function createDatabaseConnectionMonitor({ connect, onConnected, wait = waitForRetry, logger = console }) {
  let monitorPromise

  return function start() {
    if (!monitorPromise) {
      monitorPromise = (async () => {
        let attempt = 0
        while (true) {
          try {
            await connect()
            if (onConnected) {
              try {
                await onConnected()
              } catch (error) {
                logger.error(`Post-connect initialization failed (${error.name || 'Error'})`)
              }
            }
            return
          } catch {
            const delayMs = Math.min(1_000 * (2 ** Math.min(attempt, 5)), MAX_RETRY_DELAY_MS)
            attempt += 1
            logger.warn(`MongoDB retry scheduled in ${delayMs}ms`)
            await wait(delayMs)
          }
        }
      })()
    }

    return monitorPromise
  }
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!mongoConfigurationReported) {
    console.info(`${runtimeLogPrefix()} MongoDB connection variable MONGODB_URI is ${uri ? 'configured' : 'missing'}`)
    mongoConfigurationReported = true
  }
  if (!uri) {
    console.error(`${runtimeLogPrefix()} MongoDB connection failed (ConfigurationError): MONGODB_URI is required`)
    throw new Error('MONGODB_URI is required')
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (connectionPromise) return connectionPromise

  connectionPromise = mongoose.connect(uri)
    .then(() => {
      if (process.env.NODE_ENV !== 'production') console.info(`${runtimeLogPrefix()} MongoDB connected`)
      return mongoose.connection
    })
    .catch((error) => {
      console.error(`${runtimeLogPrefix()} MongoDB connection failed (${error.name}): ${formatMongoConnectionError(error, uri)}`)
      throw new Error(`MongoDB connection failed (${error.name})`)
    })

  try {
    return await connectionPromise
  } finally {
    connectionPromise = undefined
  }
}

export function startDatabaseConnection({ onConnected } = {}) {
  if (!databaseMonitor) {
    databaseMonitor = createDatabaseConnectionMonitor({
      connect: connectDatabase,
      onConnected,
      logger: {
        warn: (message) => console.warn(`${runtimeLogPrefix()} ${message}`),
        error: (message) => console.error(`${runtimeLogPrefix()} ${message}`),
      },
    })
  }

  return databaseMonitor()
}
