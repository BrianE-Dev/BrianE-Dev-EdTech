import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import test from 'node:test'

async function reservePort() {
  const probe = createServer()
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const { port } = probe.address()
  await new Promise((resolve) => probe.close(resolve))
  return port
}

function startupEnvironment(port) {
  return {
    ...process.env,
    PORT: String(port),
    APP_ENV: 'development',
    NODE_ENV: 'production',
    JWT_SECRET: 'hostinger-startup-test-secret-with-more-than-thirty-two-characters',
    MONGODB_URI: 'mongodb://127.0.0.1:1/startup-test',
    PAYSTACK_PUBLIC_KEY: 'pk_test_hostinger',
    PAYSTACK_SECRET_KEY: 'sk_test_hostinger',
    PAYSTACK_BASE_URL: 'https://api.paystack.co',
  }
}

test('Hostinger require entry listens promptly and serves liveness while MongoDB is unavailable', async (context) => {
  const port = await reservePort()
  const child = spawn(process.execPath, ['-e', "require('./server.js'); import('./server.js?duplicate-entry')"], {
    cwd: process.cwd(),
    env: startupEnvironment(port),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let logs = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { logs += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { logs += chunk })
  context.after(() => child.kill())

  const start = Date.now()
  while (Date.now() - start < 2_700 && !logs.includes('HTTP listener bound')) {
    assert.equal(child.exitCode, null, `startup process exited before binding: ${logs}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.match(logs, /HTTP listener bound/, `server did not call listen within 2.7 seconds: ${logs}`)
  const duplicateDeadline = Date.now() + 1_000
  while (Date.now() < duplicateDeadline && !logs.includes('duplicate server.js startup ignored')) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.match(logs, /\[pid=\d+ startup=[0-9a-f-]+\] BrianE-Dev HTTP listener bound/)
  assert.match(logs, /duplicate server\.js startup ignored/)
  assert.equal([...logs.matchAll(/HTTP listener bound/g)].length, 1, 'duplicate entry evaluation must not bind a second listener')

  let live
  const liveDeadline = Date.now() + 15_000
  while (Date.now() < liveDeadline) {
    if (child.exitCode !== null) break
    try {
      live = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (live.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  assert.equal(child.exitCode, null, `startup process exited early: ${logs}`)
  assert.ok(live?.ok, `server did not become live after initialization: ${logs}`)
  assert.deepEqual(await live.json(), { ok: true })

  const ready = await fetch(`http://127.0.0.1:${port}/api/ready`)
  assert.equal(ready.status, 503)
  assert.deepEqual(await ready.json(), { ok: false, database: 'unavailable' })

  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/courses`)
  assert.equal(protectedRoute.status, 503)
  assert.doesNotMatch(logs, /ERR_REQUIRE_ASYNC_MODULE/)
})

test('the regular Render server entry still listens and reports database readiness', async (context) => {
  const port = await reservePort()
  const child = spawn(process.execPath, ['backend/src/start.js'], {
    cwd: process.cwd(),
    env: startupEnvironment(port),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  context.after(() => child.kill())

  const start = Date.now()
  let live
  while (Date.now() - start < 15_000) {
    if (child.exitCode !== null) break
    try {
      live = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (live.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  assert.equal(child.exitCode, null)
  assert.ok(live?.ok, 'the standard backend entry should serve liveness without waiting for MongoDB')
  const ready = await fetch(`http://127.0.0.1:${port}/api/ready`)
  assert.equal(ready.status, 503)
})
