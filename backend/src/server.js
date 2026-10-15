import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { startDatabaseConnection } from './config/database.js'
import { runtimeLogPrefix, serverKey } from './config/runtimeIdentity.js'
import { getPaystackConfig } from './config/paystack.js'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))

function validateEnvironment() {
  const portValue = process.env.PORT
  const port = portValue === undefined ? 4000 : Number(portValue)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
  getPaystackConfig()
  return port
}

export async function loadApplication() {
  dotenv.config({ path: envPath })
  validateEnvironment()
  const { default: app } = await import('./app.js')
  return app
}

export function startDatabaseMonitor() {
  return startDatabaseConnection({
    onConnected: async () => {
      const { resumeCourseAudioBatches } = await import('./services/ttsGeneration.js')
      await resumeCourseAudioBatches()
    },
  })
}

export function startServer() {
  if (globalThis[serverKey]) {
    console.warn(`${runtimeLogPrefix()} duplicate startServer() call ignored`)
    return globalThis[serverKey].promise || Promise.resolve(globalThis[serverKey])
  }
  const startup = { promise: undefined }
  globalThis[serverKey] = startup
  startup.promise = (async () => {
    const app = await loadApplication()
    const port = validateEnvironment()
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`${runtimeLogPrefix()} BrianE-Dev API listening on ${port}`)
      startDatabaseMonitor()
    })
    startup.server = server

    server.on('error', (error) => {
      console.error(`${runtimeLogPrefix()} BrianE-Dev HTTP server failed (${error.code || error.name})`)
      process.exitCode = 1
    })
    return server
  })().catch((error) => {
    if (globalThis[serverKey] === startup) delete globalThis[serverKey]
    throw error
  })
  return startup.promise
}

dotenv.config({ path: envPath })
