import { randomUUID } from 'node:crypto'

const identityKey = Symbol.for('briane-dev.runtime-identity')
export const serverKey = Symbol.for('briane-dev.http-server')

export const runtimeIdentity = globalThis[identityKey] ??= {
  pid: process.pid,
  startupId: randomUUID(),
}

export function runtimeLogPrefix() {
  return `[pid=${runtimeIdentity.pid} startup=${runtimeIdentity.startupId}]`
}
