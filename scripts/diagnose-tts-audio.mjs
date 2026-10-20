import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TtsAudio } from '../backend/src/models/index.js'
import { createTtsStorage } from '../backend/src/services/ttsStorage.js'
import { classifyTtsDiagnosticStorageError, diagnoseTtsAudioRecovery, getReadOnlyMongoConnectionOptions, resolveMongoDatabaseSelection, sanitizedTtsDiagnosticConfig } from '../backend/src/services/ttsRecoveryDiagnostic.js'

const backendEnvPath = fileURLToPath(new URL('../backend/.env', import.meta.url))
dotenv.config({ path: resolve(backendEnvPath), quiet: true })

const [courseId] = process.argv.slice(2)
if (!courseId || !mongoose.isValidObjectId(courseId)) {
  console.error('Usage: node scripts/diagnose-tts-audio.mjs <courseObjectId>')
  process.exit(2)
}

const uri = process.env.MONGODB_URI?.trim()
if (!uri) {
  console.error('MONGODB_URI is not configured in this runtime or backend/.env')
  process.exit(2)
}
const databaseSelection = resolveMongoDatabaseSelection(uri)

console.log(JSON.stringify({
  source: 'runtime environment or backend/.env (secret values omitted)',
  courseId,
  configuration: sanitizedTtsDiagnosticConfig(process.env, uri),
}))
if (!databaseSelection.database) {
  console.error(JSON.stringify({ databaseSelection: 'refused', reason: databaseSelection.reason }))
  process.exit(2)
}

try {
  await mongoose.connect(uri, getReadOnlyMongoConnectionOptions())
  if (mongoose.connection.name !== databaseSelection.database) {
    throw Object.assign(new Error('Connected database does not match the explicit URI database selection'), { code: 'DATABASE_SELECTION_MISMATCH' })
  }
  console.log(JSON.stringify({
    databaseProbe: 'connected',
    selectedDatabase: mongoose.connection.name,
    collection: TtsAudio.collection.name,
    canonicalChapterCount: 43,
  }))

  let storage
  let storageConfigurationError = null
  try {
    storage = createTtsStorage(process.env)
  } catch (error) {
    storageConfigurationError = classifyTtsDiagnosticStorageError(error)
    storage = { async exists() { throw error } }
  }

  const chapters = await diagnoseTtsAudioRecovery({ courseId, AudioModel: TtsAudio, storage })
  console.log(JSON.stringify({
    storageConfiguration: storageConfigurationError || 'configured',
    diagnosticIsReadOnly: true,
    geminiRequestsMade: 0,
    playbackVerification: 'HEAD existence checks only; authenticated GET, content validation, and browser decoding are not exercised',
    chapters,
  }, null, 2))
} catch (error) {
  const mongoError = error?.name?.startsWith('Mongo') || error?.name?.startsWith('Mongoose')
  console.error(JSON.stringify({
    diagnostic: 'failed',
    errorClass: mongoError ? 'database_connection_error' : 'diagnostic_error',
    errorName: error?.name || 'Error',
    errorCode: typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code) : null,
  }))
  process.exitCode = 1
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
