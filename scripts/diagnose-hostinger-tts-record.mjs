import mongoose from 'mongoose'
import { TtsAudio } from '../backend/src/models/index.js'
import { createTtsStorage } from '../backend/src/services/ttsStorage.js'
import { classifyTtsDiagnosticStorageError, resolveMongoDatabaseSelection } from '../backend/src/services/ttsRecoveryDiagnostic.js'
import { checkHostingerTtsRecordObjects, determineStoredCourseIdType, hostingerTtsProbeTarget, getHostingerTtsRuntimeConfig, summarizeTtsStorageConfig } from '../backend/src/services/hostingerTtsProbe.js'

const { courseId, chapterId } = hostingerTtsProbeTarget
let connected = false
let stage = 'runtime configuration validation'

try {
  // No dotenv loading: this probe uses only variables injected into the running Hostinger app.
  const { uri, mongoHost } = getHostingerTtsRuntimeConfig(process.env)
  const databaseSelection = resolveMongoDatabaseSelection(uri)
  const expectedDatabase = databaseSelection.database
  if (!expectedDatabase) throw new Error('Refusing to run: runtime MongoDB URI must explicitly select its database.')

  const storageConfig = summarizeTtsStorageConfig(process.env)
  console.log(JSON.stringify({
    runtime: 'Hostinger production variables confirmed',
    mongoHost,
    storage: storageConfig,
    courseId,
    chapterId,
  }))

  stage = 'MongoDB connection'
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  })
  connected = true
  if (mongoose.connection.name !== expectedDatabase) {
    throw new Error('Refusing to query: connected database differs from the explicit runtime database selection.')
  }

  stage = 'read-only record lookup'
  const collection = TtsAudio.collection
  // Inspect the known chapter first to verify the BSON type actually stored for this courseId.
  const sampleDocuments = await collection.find({ chapterId }).project({ courseId: 1 }).maxTimeMS(15000).toArray()
  const storedCourseId = determineStoredCourseIdType(sampleDocuments, courseId)
  const query = { courseId: storedCourseId.value }
  const statusCounts = await collection.aggregate([
    { $match: query },
    { $group: {
      _id: '$status',
      records: { $sum: 1 },
      recordsWithChunks: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$chunks', []] } }, 0] }, 1, 0] } },
    } },
  ], { maxTimeMS: 15000 }).toArray()
  const chapterReadyRecords = await collection.find(
    { chapterId, status: 'ready' },
    { projection: { courseId: 1, status: 1, chunks: 1, updatedAt: 1 } },
  ).sort({ updatedAt: -1, _id: -1 }).maxTimeMS(15000).toArray()
  const record = chapterReadyRecords.find((candidate) => String(candidate.courseId) === courseId) || chapterReadyRecords[0] || null

  let objectChecks = { recordFound: false, accessible: 0, missing: 0, permissionOrAuthentication: 0, network: 0, otherErrors: 0 }
  if (record) {
    let storage
    stage = 'storage object checks'
    try {
      storage = createTtsStorage(process.env)
      objectChecks = { recordFound: true, ...(await checkHostingerTtsRecordObjects(record, storage)) }
    } catch (error) {
      objectChecks = {
        recordFound: true,
        chunkCount: (record.chunks || []).length,
        accessible: 0,
        missing: 0,
        permissionOrAuthentication: 0,
        network: 0,
        otherErrors: (record.chunks || []).length,
        storageConfigurationError: classifyTtsDiagnosticStorageError(error),
      }
    }
  }

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    collection: collection.collectionName,
    courseIdStoredType: storedCourseId.type,
    courseIdMatchesTarget: String(storedCourseId.value) === courseId,
    recordCountsByStatus: statusCounts.map(({ _id, records, recordsWithChunks }) => ({ status: _id || '(unset)', records, recordsWithChunks })),
    selectedRecord: record ? {
      status: record.status,
      updatedAt: record.updatedAt || null,
      courseIdMatchesTarget: String(record.courseId) === courseId,
      courseIdStoredType: typeof record.courseId === 'string' ? 'string' : record.courseId?._bsontype === 'ObjectId' ? 'objectId' : typeof record.courseId,
    } : { recordFound: false },
    chunkObjectChecks: objectChecks,
    readOnly: true,
    geminiRequestsMade: 0,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    diagnostic: 'refused_or_failed',
    reason: stage === 'runtime configuration validation' ? error.message : `Diagnostic stopped during ${stage}; sensitive connection or object details were suppressed.`,
    errorClass: classifyTtsDiagnosticStorageError(error),
  }))
  process.exitCode = 1
} finally {
  if (connected) await mongoose.disconnect()
}
