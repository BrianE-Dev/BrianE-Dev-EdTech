import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabaseConnectionMonitor } from '../backend/src/config/database.js'

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
