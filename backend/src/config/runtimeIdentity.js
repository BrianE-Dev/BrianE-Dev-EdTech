import { randomUUID } from 'node:crypto'
import { writeSync } from 'node:fs'

const identityKey = Symbol.for('briane-dev.runtime-identity')
export const serverKey = Symbol.for('briane-dev.http-server')
const diagnosticsKey = Symbol.for('briane-dev.process-diagnostics')

export const runtimeIdentity = globalThis[identityKey] ??= {
  pid: process.pid,
  ppid: process.ppid,
  startupId: randomUUID(),
}

export function runtimeLogPrefix() {
  return `[pid=${runtimeIdentity.pid} ppid=${runtimeIdentity.ppid} uptime=${process.uptime().toFixed(1)}s startup=${runtimeIdentity.startupId}]`
}

function safeErrorName(error) {
  const name = typeof error?.name === 'string' ? error.name : typeof error
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(name) ? name : 'UnknownError'
}

function writeLifecycleLog(message) {
  try {
    writeSync(2, `${runtimeLogPrefix()} ${message}\n`)
  } catch {
    // Lifecycle reporting must never interfere with process termination.
  }
}

export function installProcessDiagnostics() {
  if (globalThis[diagnosticsKey]) return
  const state = { fatalEventLogged: false }
  globalThis[diagnosticsKey] = state

  process.on('exit', (code) => {
    writeLifecycleLog(`process exiting code=${code}`)
  })

  const terminateAfterFatalError = (message) => {
    if (state.fatalEventLogged) return
    state.fatalEventLogged = true
    writeLifecycleLog(message)
    process.exitCode = 1
    process.exit(1)
  }

  process.on('uncaughtException', (error, origin) => {
    terminateAfterFatalError(`uncaught exception; terminating without recovery (origin=${origin}, error=${safeErrorName(error)})`)
  })
  process.on('unhandledRejection', (reason) => {
    terminateAfterFatalError(`unhandled rejection; terminating without recovery (error=${safeErrorName(reason)})`)
  })
}
