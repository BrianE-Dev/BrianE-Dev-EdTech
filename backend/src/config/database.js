import mongoose from 'mongoose'

let connectionPromise
let databaseMonitor
const MAX_RETRY_DELAY_MS = 30_000
const DATABASE_CONNECTION_ERRORS = new Set([
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
])

const waitForRetry = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

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
  if (!uri) {
    console.error('MongoDB connection failed (ConfigurationError): MONGODB_URI is required')
    throw new Error('MONGODB_URI is required')
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (connectionPromise) return connectionPromise

  connectionPromise = mongoose.connect(uri)
    .then(() => {
      if (process.env.NODE_ENV !== 'production') console.info('MongoDB connected')
      return mongoose.connection
    })
    .catch((error) => {
      const safeMessage = String(error.message)
        .replaceAll(uri, '[redacted MongoDB URI]')
        .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]')
      console.error(`MongoDB connection failed (${error.name}): ${safeMessage}`)
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
    })
  }

  return databaseMonitor()
}
