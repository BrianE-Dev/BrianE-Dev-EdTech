import mongoose from 'mongoose'

let connectionPromise

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('MONGODB_URI is required')
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
