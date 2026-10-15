import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabaseConnectionMonitor, formatMongoConnectionError } from '../backend/src/config/database.js'

test('database connection monitor retries with bounded backoff and resolves after recovery once', async () => {
  let attempts = 0
  let connectedCallbacks = 0
  const delays = []
  const warnings = []
  const start = createDatabaseConnectionMonitor({
    async connect() {
      attempts += 1
      if (attempts < 4) throw new Error('temporary connection failure')
    },
    async onConnected() { connectedCallbacks += 1 },
    async wait(delayMs) { delays.push(delayMs) },
    logger: { warn(message) { warnings.push(message) }, error() {} },
  })

  const monitor = start()
  assert.equal(start(), monitor)
  await monitor

  assert.equal(attempts, 4)
  assert.deepEqual(delays, [1_000, 2_000, 4_000])
  assert.equal(connectedCallbacks, 1)
  assert.equal(warnings.length, 3)
})

test('database connection monitor caps retry delay and does not retry post-connect initialization', async () => {
  const delays = []
  let attempts = 0
  let initializationAttempts = 0
  const errors = []
  const start = createDatabaseConnectionMonitor({
    async connect() {
      attempts += 1
      if (attempts < 8) throw new Error('temporary connection failure')
    },
    async onConnected() {
      initializationAttempts += 1
      throw new Error('resume failure')
    },
    async wait(delayMs) { delays.push(delayMs) },
    logger: { warn() {}, error(message) { errors.push(message) } },
  })

  await start()

  assert.deepEqual(delays, [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000])
  assert.equal(attempts, 8)
  assert.equal(initializationAttempts, 1)
  assert.equal(errors.length, 1)
})

test('MongoDB diagnostic output redacts credentials while retaining nested failure codes', () => {
  const uri = 'mongodb+srv://private-user:private-password@private-cluster.example/app'
  const networkError = Object.assign(new Error('connect ETIMEDOUT private-cluster.example:27017'), {
    name: 'MongoNetworkError',
    cause: Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }),
  })
  const error = Object.assign(new Error(`Server selection failed for ${uri}; password=private-password`), {
    name: 'MongooseServerSelectionError',
    reason: { servers: new Map([['server', { error: networkError }]]) },
  })

  const diagnostic = formatMongoConnectionError(error, uri)
  assert.match(diagnostic, /MongooseServerSelectionError/)
  assert.match(diagnostic, /ETIMEDOUT/)
  assert.match(diagnostic, /network timeout/)
  assert.doesNotMatch(diagnostic, /private-user|private-password|private-cluster\.example/)
})

test('MongoDB diagnostic classifies DNS and authentication errors without logging usernames', () => {
  const dnsError = Object.assign(new Error('querySrv ENOTFOUND _mongodb._tcp.cluster.invalid'), {
    name: 'MongooseServerSelectionError',
    cause: Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }),
  })
  const authError = Object.assign(new Error('Authentication failed for user=private-user'), {
    name: 'MongoServerError',
    code: 18,
    codeName: 'AuthenticationFailed',
  })

  assert.match(formatMongoConnectionError(dnsError), /DNS\/SRV resolution/)
  const authDiagnostic = formatMongoConnectionError(authError)
  assert.match(authDiagnostic, /authentication/)
  assert.doesNotMatch(authDiagnostic, /private-user/)
})

test('MongoDB diagnostic identifies TLS alerts without exposing nested error messages', () => {
  const tlsError = Object.assign(new Error('MongoNetworkError: ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'), {
    name: 'MongoNetworkError',
    cause: Object.assign(new Error('TLS peer rejected handshake for private-cluster.example'), {
      code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',
    }),
  })

  const diagnostic = formatMongoConnectionError(tlsError)
  assert.match(diagnostic, /ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR/)
  assert.match(diagnostic, /TLS handshake or certificate negotiation/)
  assert.doesNotMatch(diagnostic, /private-cluster\.example/)
})
