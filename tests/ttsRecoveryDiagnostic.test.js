import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/data/curriculum.js'
import { getLessonByChapterId } from '../backend/src/services/lessonRepository.js'
import { buildTtsTranscript, hashTranscript } from '../backend/src/services/ttsTranscript.js'
import { classifyTtsDiagnosticStorageError, diagnoseTtsAudioRecovery, getReadOnlyMongoConnectionOptions, resolveMongoDatabaseSelection, sanitizedTtsDiagnosticConfig } from '../backend/src/services/ttsRecoveryDiagnostic.js'

function fakeAudioModel(records, verifyFilter = () => {}) {
  let writeCalls = 0
  return {
    get writeCalls() { return writeCalls },
    find(filter) {
      verifyFilter(filter)
      return {
        select() { return this },
        maxTimeMS() { return this },
        lean() { return this },
        then(resolve, reject) { return Promise.resolve(records).then(resolve, reject) },
      }
    },
    async updateOne() { writeCalls += 1; throw new Error('Diagnostic must not write records') },
    async findOneAndUpdate() { writeCalls += 1; throw new Error('Diagnostic must not write records') },
    async deleteMany() { writeCalls += 1; throw new Error('Diagnostic must not write records') },
  }
}

test('read-only recovery diagnostic scans all 43 canonical chapters and inventories historical records', async () => {
  const chapter = curriculum.sections[0].chapters[0]
  const lesson = await getLessonByChapterId(chapter.id)
  const currentHash = hashTranscript(buildTtsTranscript(lesson))
  const records = [
    { _id: 'current-ready', chapterId: chapter.id, status: 'ready', transcriptHash: currentHash, updatedAt: new Date('2026-01-04'), chunks: [{ order: 1, storageKey: 'current-1' }, { order: 2, storageKey: 'current-2' }] },
    { _id: 'historical-ready', chapterId: chapter.id, status: 'ready', transcriptHash: 'old-transcript', updatedAt: new Date('2025-01-01'), chunks: [{ order: 1, storageKey: 'historical' }] },
    { _id: 'failed-complete', chapterId: chapter.id, status: 'failed', transcriptHash: 'failed-hash', updatedAt: new Date('2025-02-01'), chunks: [{ order: 1, storageKey: 'failed-object' }] },
    { _id: 'pending-missing', chapterId: chapter.id, status: 'pending', transcriptHash: 'pending-hash', updatedAt: new Date('2025-03-01'), chunks: [{ order: 1, storageKey: 'missing-object' }] },
  ]
  const checkedKeys = []
  const AudioModel = fakeAudioModel(records, (filter) => {
    assert.equal(filter.courseId, 'course-diagnostic')
    assert.deepEqual(filter.chapterId.$in, curriculum.sections.flatMap((section) => section.chapters).map((item) => item.id))
  })
  const storage = {
    async exists(key) { checkedKeys.push(key); return key !== 'missing-object' },
    async upload() { throw new Error('Diagnostic must not upload') },
    async delete() { throw new Error('Diagnostic must not delete') },
  }

  const report = await diagnoseTtsAudioRecovery({ courseId: 'course-diagnostic', AudioModel, storage })
  assert.equal(report.length, 43)
  const chapterReport = report.find((item) => item.chapterId === chapter.id)
  assert.equal(chapterReport.title, chapter.title)
  assert.equal(chapterReport.currentTranscriptHash, currentHash)
  assert.equal(chapterReport.recordCount, 4)
  assert.equal(chapterReport.completeReadyPlaybackCandidateAvailable, true)
  assert.equal(chapterReport.completePlayableHistoricalRecordingAvailable, true)
  assert.equal(chapterReport.selectedByCurrentPlaybackLookup, 'current-ready')
  assert.equal(chapterReport.records.find((item) => item.recordId === 'current-ready').matchesCurrentCanonicalTranscript, true)
  assert.equal(chapterReport.records.find((item) => item.recordId === 'historical-ready').selectedByCurrentPlaybackLookup, false)
  assert.equal(chapterReport.records.find((item) => item.recordId === 'historical-ready').recoveryHint, 'complete_ready_record_not_selected_by_current_lookup')
  assert.equal(chapterReport.records.find((item) => item.recordId === 'failed-complete').completeButNotPlaybackReady, true)
  assert.equal(chapterReport.records.find((item) => item.recordId === 'pending-missing').allReferencedObjectsExist, false)
  assert.deepEqual(checkedKeys.sort(), ['current-1', 'current-2', 'failed-object', 'historical', 'missing-object'].sort())
  assert.equal(AudioModel.writeCalls, 0)
  assert.ok(records.every((record) => !Object.hasOwn(record, '_diagnosticCompleteObjectSet')))
})

test('storage errors leave object existence unknown and are not reported as missing', async () => {
  const chapter = curriculum.sections[0].chapters[0]
  const records = [{ _id: 'uncertain', chapterId: chapter.id, status: 'ready', transcriptHash: 'older', chunks: [{ order: 1, storageKey: 'unknown-object' }] }]
  const report = await diagnoseTtsAudioRecovery({
    courseId: 'course-diagnostic',
    AudioModel: fakeAudioModel(records),
    storage: { async exists() { throw Object.assign(new Error('safe storage error', { cause: new Error('Object check failed (403)') }), { code: 'AUDIO_STORAGE_UNAVAILABLE' }) } },
    chapters: [chapter],
  })
  assert.equal(report[0].records[0].allReferencedObjectsExist, null)
  assert.equal(report[0].records[0].chunks[0].state, 'unknown')
  assert.equal(report[0].records[0].chunks[0].errorClass, 'permission_error')
  assert.equal(report[0].completeReadyPlaybackCandidateAvailable, false)
})

test('sanitized deployment identity omits Mongo credentials and storage secret values', () => {
  const config = sanitizedTtsDiagnosticConfig({
    NODE_ENV: 'production', TTS_S3_PROVIDER: 's3', TTS_S3_ENDPOINT: 'https://account.example.invalid/s3',
    TTS_S3_BUCKET: 'audio-bucket', TTS_S3_REGION: 'auto', TTS_S3_ACCESS_KEY_ID: 'private-access', TTS_S3_SECRET_ACCESS_KEY: 'private-secret',
  }, 'mongodb+srv://private-user:private-password@cluster.example.invalid/dbname?retryWrites=true')
  const serialized = JSON.stringify(config)
  assert.equal(config.mongoHost, 'cluster.example.invalid')
  assert.equal(config.mongoUriDatabase, 'dbname')
  assert.equal(config.storageEndpointHost, 'account.example.invalid')
  assert.equal(config.storageBucket, 'audio-bucket')
  assert.doesNotMatch(serialized, /private-user|private-password|private-access|private-secret|mongodb\+srv:/)
})

test('database selection follows the explicit URI path used by the application', () => {
  assert.deepEqual(
    resolveMongoDatabaseSelection('mongodb+srv://private-user:private-password@cluster.example.invalid/briane_prod?retryWrites=true'),
    { database: 'briane_prod', source: 'uri_path', reason: null },
  )
})

test('database selection honors the explicit dbName URI option when the path is absent', () => {
  assert.deepEqual(
    resolveMongoDatabaseSelection('mongodb+srv://cluster.example.invalid/?dbName=briane_prod&retryWrites=true'),
    { database: 'briane_prod', source: 'uri_dbName_option', reason: null },
  )
})

test('diagnostic refuses implicit test fallback and ambiguous database options', () => {
  const noDatabase = resolveMongoDatabaseSelection('mongodb+srv://cluster.example.invalid/?retryWrites=true')
  assert.equal(noDatabase.database, null)
  assert.match(noDatabase.reason, /would otherwise default to test/i)
  assert.notEqual(noDatabase.database, 'test')

  const ambiguous = resolveMongoDatabaseSelection('mongodb://localhost/?dbName=one&dbName=two')
  assert.equal(ambiguous.database, null)
  assert.match(ambiguous.reason, /ambiguous/i)
})

test('diagnostic connection disables Mongoose collection and index creation', () => {
  assert.deepEqual(getReadOnlyMongoConnectionOptions(), {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  })
})

test('diagnostic storage error classes distinguish object absence from access/configuration failures', () => {
  const wrap = (message) => Object.assign(new Error('safe'), { code: 'AUDIO_STORAGE_UNAVAILABLE', cause: new Error(message) })
  assert.equal(classifyTtsDiagnosticStorageError(wrap('Object check failed (404)')), 'missing_object')
  assert.equal(classifyTtsDiagnosticStorageError(wrap('Object check failed (403)')), 'permission_error')
  assert.equal(classifyTtsDiagnosticStorageError(wrap('Object check failed (401)')), 'authentication_error')
  assert.equal(classifyTtsDiagnosticStorageError(wrap('S3-compatible storage credentials are incomplete')), 'storage_configuration_error')
})
