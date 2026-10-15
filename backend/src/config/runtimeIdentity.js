import { randomUUID } from 'node:crypto'

const identityKey = Symbol.for('briane-dev.runtime-identity')
export const serverKey = Symbol.for('briane-dev.http-server')

export const runtimeIdentity = globalThis[identityKey] ??= {
  pid: process.pid,
  ppid: process.ppid,
  startupId: randomUUID(),
}

export function runtimeLogPrefix() {
  return `[pid=${runtimeIdentity.pid} ppid=${runtimeIdentity.ppid} uptime=${process.uptime().toFixed(1)}s startup=${runtimeIdentity.startupId}]`
}
