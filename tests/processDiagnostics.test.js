import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

async function runFatalChild(source) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { logs += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { logs += chunk })
  const [code, signal] = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (exitCode, exitSignal) => resolve([exitCode, exitSignal]))
  })
  return { code, signal, logs }
}

test('uncaught exceptions are logged without replacing Node.js fail-stop behavior', async () => {
  const result = await runFatalChild(`
    import { installProcessDiagnostics } from './backend/src/config/runtimeIdentity.js'
    installProcessDiagnostics()
    setImmediate(() => { throw new Error('PRIVATE_EXCEPTION_MESSAGE') })
  `)

  assert.equal(result.code, 1)
  assert.match(result.logs, /uncaught exception; terminating without recovery \(origin=uncaughtException, error=Error\)/)
  assert.match(result.logs, /process exiting code=1/)
  assert.doesNotMatch(result.logs, /PRIVATE_EXCEPTION_MESSAGE/)
})

test('unhandled rejections are logged and terminate instead of leaving the server running', async () => {
  const result = await runFatalChild(`
    import { installProcessDiagnostics } from './backend/src/config/runtimeIdentity.js'
    installProcessDiagnostics()
    Promise.reject(new Error('PRIVATE_REJECTION_MESSAGE'))
    setInterval(() => {}, 1000)
  `)

  assert.equal(result.code, 1)
  assert.match(result.logs, /unhandled rejection; terminating without recovery \(error=Error\)/)
  assert.match(result.logs, /process exiting code=1/)
  assert.doesNotMatch(result.logs, /PRIVATE_REJECTION_MESSAGE/)
})
