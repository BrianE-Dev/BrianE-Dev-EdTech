import crypto from 'node:crypto'
import { curriculum } from '../../../src/data/curriculum.js'
import { getLessonByChapterId } from './lessonRepository.js'
import { buildTtsTranscript, hashTranscript } from './ttsTranscript.js'

const canonicalChapters = curriculum.sections.flatMap((section) => section.chapters)

export function classifyTtsDiagnosticStorageError(error) {
  if (error?.code === 'AUDIO_STORAGE_UNAVAILABLE') {
    const detail = String(error.cause?.message || '')
    const httpStatus = detail.match(/(?:failed|check failed) \((\d{3})\)/)?.[1]
    const operation = (error.operation && error.operation !== 'unknown' ? error.operation : null) || ({
      'Object upload failed': 'PUT',
      'Object read failed': 'GET',
      'Object check failed': 'HEAD',
      'Object deletion failed': 'DELETE',
    }[detail.match(/^Object (?:upload|read|check|deletion) failed/)?.[0]] || 'unknown')
    const providerCode = error.providerCode || null
    if (httpStatus === '401') return 'authentication_error'
    if (httpStatus === '403') return 'permission_error'
    if (httpStatus === '404') {
      if (['NoSuchBucket', 'InvalidBucketName'].includes(providerCode) || operation === 'PUT') return 'storage_target_not_found'
      if (['NoSuchKey', 'NoSuchObject'].includes(providerCode)) return 'missing_object'
      return 'storage_http_404'
    }
    if (httpStatus && Number(httpStatus) < 500) return `endpoint_or_request_http_${httpStatus}`
    if (httpStatus) return `provider_http_${httpStatus}`
    if (/credentials are incomplete|endpoint must use HTTPS|provider is invalid/i.test(detail)) return 'storage_configuration_error'
    let cause = error.cause
    while (cause) {
      const marker = `${cause.code || ''} ${cause.name || ''} ${cause.message || ''}`
      if (/ENOTFOUND|EAI_AGAIN/i.test(marker)) return 'dns_error'
      if (/TLS|SSL|CERT/i.test(marker)) return 'tls_error'
      if (/ETIMEDOUT|ETIMEOUT|timeout/i.test(marker)) return 'timeout'
      if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EACCES/i.test(marker)) return 'connection_error'
      cause = cause.cause
    }
    return 'storage_request_error'
  }
  if (error?.code === 'TTS_STORAGE_KEY_INVALID') return 'invalid_stored_key'
  return 'storage_check_error'
}

export function resolveMongoDatabaseSelection(uri) {
  try {
    const parsed = new URL(uri)
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
      return { database: null, source: null, reason: 'MONGODB_URI must use mongodb:// or mongodb+srv:// and explicitly select a database.' }
    }
    const pathDatabase = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    if (pathDatabase) return { database: pathDatabase, source: 'uri_path', reason: null }

    const databaseOptions = [...parsed.searchParams.entries()].filter(([key]) => key.toLowerCase() === 'dbname')
    if (databaseOptions.length === 1 && databaseOptions[0][1].trim()) {
      return { database: databaseOptions[0][1].trim(), source: 'uri_dbName_option', reason: null }
    }
    if (databaseOptions.length > 1) {
      return { database: null, source: null, reason: 'MONGODB_URI has multiple dbName options; refusing an ambiguous database selection.' }
    }
    return { database: null, source: null, reason: 'MONGODB_URI has no explicit database path or dbName option; Mongoose would otherwise default to test. Add the intended database name to MONGODB_URI.' }
  } catch {
    return { database: null, source: null, reason: 'MONGODB_URI is invalid or does not identify a database.' }
  }
}

export function getReadOnlyMongoConnectionOptions() {
  return { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, autoIndex: false, autoCreate: false }
}

async function checkRecordObjects(record, storage) {
  const chunks = []
  for (const chunk of record.chunks || []) {
    try {
      chunks.push({ order: chunk.order ?? null, keyFingerprint: crypto.createHash('sha256').update(String(chunk.storageKey || '')).digest('hex').slice(0, 12), state: await storage.exists(chunk.storageKey) ? 'exists' : 'missing' })
    } catch (error) {
      chunks.push({ order: chunk.order ?? null, state: 'unknown', errorClass: classifyTtsDiagnosticStorageError(error) })
    }
  }
  const everyChunkExists = chunks.length > 0 && chunks.every((chunk) => chunk.state === 'exists')
  const anyChunkMissing = chunks.some((chunk) => chunk.state === 'missing')
  return {
    chunks,
    allReferencedObjectsExist: everyChunkExists ? true : anyChunkMissing || chunks.length === 0 ? false : null,
    completeObjectSet: everyChunkExists,
  }
}

function timestampValue(value) {
  const parsed = new Date(value || 0).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function getSelectedReadyRecord(records, currentTranscriptHash) {
  return records
    .filter(({ source, data }) => source.status === 'ready' && data.allReferencedObjectsExist === true)
    .sort((left, right) => Number(right.source.transcriptHash === currentTranscriptHash) - Number(left.source.transcriptHash === currentTranscriptHash)
      || timestampValue(right.source.updatedAt) - timestampValue(left.source.updatedAt))[0] || null
}

/** Read-only inventory: one metadata query and storage HEAD/exists checks only. */
export async function diagnoseTtsAudioRecovery({
  courseId,
  AudioModel,
  storage,
  chapters = canonicalChapters,
  loadLesson = getLessonByChapterId,
}) {
  const chapterIds = chapters.map((chapter) => chapter.id)
  const query = AudioModel.find({ courseId: String(courseId), chapterId: { $in: chapterIds } })
  if (typeof query.select === 'function') query.select('courseId chapterId status transcriptHash updatedAt chunks')
  if (typeof query.maxTimeMS === 'function') query.maxTimeMS(15000)
  if (typeof query.lean === 'function') query.lean()
  const records = await query
  const recordsByChapter = new Map(chapterIds.map((chapterId) => [chapterId, []]))
  for (const record of records) recordsByChapter.get(record.chapterId)?.push(record)

  const report = []
  for (const chapter of chapters) {
    const lesson = await loadLesson(chapter.id)
    const currentTranscriptHash = hashTranscript(buildTtsTranscript(lesson))
    const chapterRecords = recordsByChapter.get(chapter.id) || []
    const inspectedRecords = []
    for (const record of chapterRecords) {
      const objectCheck = await checkRecordObjects(record, storage)
      inspectedRecords.push({
        source: record,
        data: {
          recordId: String(record._id),
          status: record.status,
          transcriptHash: record.transcriptHash,
          updatedAt: record.updatedAt || null,
          chunkCount: (record.chunks || []).length,
          matchesCurrentCanonicalTranscript: record.transcriptHash === currentTranscriptHash,
          allReferencedObjectsExist: objectCheck.allReferencedObjectsExist,
          chunks: objectCheck.chunks,
          completeReadyPlaybackCandidate: record.status === 'ready' && objectCheck.completeObjectSet,
          completeButNotPlaybackReady: record.status !== 'ready' && objectCheck.completeObjectSet,
          selectedByCurrentPlaybackLookup: false,
          recoveryHint: null,
        },
      })
    }

    const selectedItem = getSelectedReadyRecord(inspectedRecords, currentTranscriptHash)
    for (const item of inspectedRecords) {
      const data = item.data
      data.selectedByCurrentPlaybackLookup = Boolean(selectedItem && selectedItem.data.recordId === data.recordId)
      if (data.completeButNotPlaybackReady) data.recoveryHint = 'complete_objects_but_non_ready_record'
      else if (data.completeReadyPlaybackCandidate && !data.selectedByCurrentPlaybackLookup) data.recoveryHint = 'complete_ready_record_not_selected_by_current_lookup'
      else if (data.allReferencedObjectsExist === false) data.recoveryHint = 'one_or_more_objects_missing_or_no_chunks'
      else if (data.allReferencedObjectsExist === null) data.recoveryHint = 'storage_check_inconclusive'
      else if (!data.completeReadyPlaybackCandidate) data.recoveryHint = 'record_not_currently_playback_eligible'
    }

    const historicalReady = inspectedRecords.some(({ data }) => data.completeReadyPlaybackCandidate && !data.matchesCurrentCanonicalTranscript)
    report.push({
      chapterId: chapter.id,
      title: chapter.title,
      currentTranscriptHash,
      recordCount: inspectedRecords.length,
      completeReadyPlaybackCandidateAvailable: inspectedRecords.some(({ data }) => data.completeReadyPlaybackCandidate),
      completePlayableHistoricalRecordingAvailable: historicalReady,
      selectedByCurrentPlaybackLookup: selectedItem ? selectedItem.data.recordId : null,
      records: inspectedRecords.map(({ data }) => data),
    })
  }
  return report
}

export function sanitizedTtsDiagnosticConfig(env, mongoUri) {
  let mongoHost = '(unavailable)'
  let mongoUriDatabase = '(not explicit)'
  const databaseSelection = resolveMongoDatabaseSelection(mongoUri)
  try {
    const parsed = new URL(mongoUri)
    mongoHost = parsed.hostname
    mongoUriDatabase = databaseSelection.database || '(not explicit)'
  } catch { /* Keep the sanitized fallback. */ }
  let endpointHost = env.TTS_S3_REGION?.trim() ? `s3.${env.TTS_S3_REGION.trim()}.amazonaws.com` : '(unset or invalid)'
  let endpointPath = '/'
  try {
    const endpoint = new URL(env.TTS_S3_ENDPOINT)
    endpointHost = endpoint.hostname
    endpointPath = endpoint.pathname || '/'
  } catch { /* Keep the sanitized fallback. */ }
  return {
    mongoHost,
    mongoUriDatabase,
    mongoDatabaseSource: databaseSelection.source || '(unresolved)',
    storageProvider: env.TTS_STORAGE_PROVIDER || (env.NODE_ENV === 'production' ? 's3' : 'local'),
    storageEndpointHost: endpointHost,
    storageEndpointPath: endpointPath,
    storageBucket: env.TTS_S3_BUCKET || '(unset)',
    storageRegion: env.TTS_S3_REGION || '(unset)',
    storageCredentialsConfigured: Boolean(env.TTS_S3_ACCESS_KEY_ID?.trim() && env.TTS_S3_SECRET_ACCESS_KEY?.trim()),
    codeObjectKeyRoot: 'brianedev/tts',
  }
}

