import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTtsTranscript, hashTranscript } from '../backend/src/services/ttsTranscript.js'
import { combineWavBuffers, generateChapterAudio, isReadyChapterAudio, loadReadyChapterAudio, processBatch, requestGeminiAudio, resumeCourseAudioBatches, splitTtsTranscript, startCourseAudioBatch, writeOwnedTtsAudio } from '../backend/src/services/ttsGeneration.js'
import { curriculum } from '../src/data/curriculum.js'

function wav(pcmBytes = 4800) {
  const pcm = Buffer.alloc(pcmBytes)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function createFakes() {
  const records = new Map()
  const objects = new Map()
  const keyFor = (identity) => JSON.stringify(Object.keys(identity).sort().map((key) => [key, identity[key]]))
  const AudioModel = {
    async findOne(identity) { const record = records.get(keyFor(identity)); return record ? structuredClone(record) : null },
    find(filter) {
      const matching = [...records.values()].filter((record) => Object.entries(filter).every(([key, value]) => record[key] === value))
      return { sort() { matching.sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)); return this }, then(resolve, reject) { return Promise.resolve(matching.map((record) => structuredClone(record))).then(resolve, reject) } }
    },
    async findOneAndUpdate(filter, update) {
      const candidates = [...records.entries()].filter(([, record]) => Object.entries(filter).every(([key, value]) => {
        if (key === '$or') return value.some((clause) => Object.entries(clause).every(([field, condition]) => condition.$ne !== undefined ? record[field] !== condition.$ne : condition.$lt !== undefined ? new Date(record[field] || 0) < condition.$lt : condition.$exists !== undefined ? (record[field] !== undefined) === condition.$exists : record[field] === condition))
        return key.startsWith('$') || record[key] === value
      }))
      const [existingKey, existing] = candidates[0] || []
      if (!existing && !update.$setOnInsert) return null
      if (existing?.status === 'generating' && update.$set?.status === 'generating' && !filter.$or?.some((clause) => clause.lastAttemptAt?.$lt || clause.generationStartedAt?.$lt)) return null
      const identity = update.$setOnInsert || Object.fromEntries(Object.entries(filter).filter(([key]) => !key.startsWith('$') && key !== 'generationToken' && key !== 'status'))
      const key = existingKey || keyFor(identity)
      const record = existing || { ...structuredClone(identity), _id: `audio-${records.size + 1}` }
      Object.assign(record, structuredClone(update.$set), { updatedAt: new Date() })
      if (update.$unset) for (const field of Object.keys(update.$unset)) delete record[field]
      records.set(key, record)
      return structuredClone(record)
    },
  }
  const storage = {
    async exists(key) { return objects.has(key) },
    async upload(key, buffer) { objects.set(key, Buffer.from(buffer)) },
    async read(key) { if (!objects.has(key)) throw new Error('missing object'); return Buffer.from(objects.get(key)) },
    async delete(key) { objects.delete(key) },
  }
  return { AudioModel, storage, records, objects }
}

const env = {
  GEMINI_API_KEY: 'test-key',
  GEMINI_TTS_MODEL: 'gemini-3.8-flash-lite-tts',
  GEMINI_TTS_VOICE: 'Kore',
  GEMINI_TTS_LANGUAGE: 'en-US',
}

function lesson(text = 'A useful lesson paragraph.') {
  return {
    chapterId: 'chapter-test-lesson', contentVersion: '1.0.0', title: 'A Test Lesson',
    objectives: ['Understand the workflow.'],
    blocks: [
      { type: 'heading', text: 'The workflow' },
      { type: 'paragraph', text },
      { type: 'code', filename: 'private-internal.js', code: 'const secret = "never narrate raw code"' },
    ],
    exercises: [],
    assessments: [{ id: 'assessment-internal', prompt: 'Question?', correctOptionId: 'secret-answer', explanation: 'Private answer key.' }],
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function batchFakes({ mode = 'missing', initial = {} } = {}) {
  const row = { _id: 'batch-1', courseId: 'course-1', status: 'running', mode, results: [], ...initial }
  const matches = (filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((clause) => Object.entries(clause).every(([field, condition]) => condition === null ? row[field] === null : condition.$exists !== undefined ? (row[field] !== undefined) === condition.$exists : condition.$lte ? new Date(row[field]) <= condition.$lte : row[field] === condition))
    if (value && typeof value === 'object' && value.$ne !== undefined) return row[key] !== value.$ne
    return row[key] === value
  })
  const apply = (update) => {
    Object.assign(row, structuredClone(update.$set || {}))
    for (const [field, value] of Object.entries(update.$push || {})) row[field].push(structuredClone(value))
  }
  const BatchModel = {
    async findOneAndUpdate(filter, update) { if (!matches(filter)) return null; apply(update); return structuredClone(row) },
    async updateOne(filter, update) { if (!matches(filter)) return { matchedCount: 0 }; apply(update); return { matchedCount: 1 } },
    findOne(filter) { return { lean: async () => matches(filter) ? structuredClone(row) : null } },
    async findById() { return structuredClone(row) },
    async findOneByCourse(filter) { return matches(filter) ? structuredClone(row) : null },
    find(filter) { return { lean: async () => row.status === filter.status ? [structuredClone(row)] : [] } },
  }
  BatchModel.findOne = (filter) => {
    if (filter._id) return { lean: async () => matches(filter) ? structuredClone(row) : null }
    return { then: (resolve, reject) => Promise.resolve(matches(filter) ? structuredClone(row) : null).then(resolve, reject) }
  }
  const AudioModel = {
    findOne() { return { sort() { return this }, then(resolve, reject) { return Promise.resolve({ status: 'ready', chunks: [{ storageKey: 'existing' }] }).then(resolve, reject) } } },
  }
  const storage = { async exists() { return true } }
  const chapters = [curriculum.sections[0].chapters[0]]
  const options = { BatchModel, AudioModel, storage, chapters, getAudioStatus: async () => ({ total: 1, ready: 1, generating: 0, failed: 0, missing: 0, stale: 0 }) }
  return { row, BatchModel, AudioModel, storage, chapters, options }
}

test('transcript is deterministic, narrates lesson blocks, and omits code and assessment internals', () => {
  const source = lesson()
  const transcript = buildTtsTranscript(source)
  assert.equal(hashTranscript(transcript), hashTranscript(buildTtsTranscript(source)))
  assert.match(transcript, /The workflow/)
  assert.match(transcript, /software development concept/)
  assert.doesNotMatch(transcript, /private-internal|never narrate raw code|secret-answer|assessment-internal|Private answer key/)
})

test('logical chunking stays under the limit and WAV chunks combine into one valid file', () => {
  const transcript = `${'First sentence. '.repeat(300)}\n\n${'Second section. '.repeat(300)}`
  const chunks = splitTtsTranscript(transcript, 900)
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.length <= 900))
  const combined = combineWavBuffers([wav(), wav()])
  assert.equal(combined.toString('ascii', 0, 4), 'RIFF')
  assert.equal(combined.readUInt32LE(40), 9600)
})

test('first generation stores audio and identical generation is a cache hit', async () => {
  const { AudioModel, storage } = createFakes()
  let calls = 0
  const options = { AudioModel, storage, env, generateAudio: async () => { calls += 1; return wav() } }
  const first = await generateChapterAudio('course-1', lesson(), options)
  const second = await generateChapterAudio('course-1', lesson(), options)
  assert.equal(first.status, 'ready')
  assert.equal(first.cacheHit, false)
  assert.equal(second.cacheHit, true)
  assert.equal(calls, 1)
})

test('a generation attempt that loses ownership cannot commit its late success', async () => {
  const { AudioModel, storage, records } = createFakes()
  let entered
  const enteredGeneration = new Promise((resolve) => { entered = resolve })
  let release
  const blocked = new Promise((resolve) => { release = resolve })
  const attempt = generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => { entered(); await blocked; return wav() } })
  await enteredGeneration
  const record = [...records.values()][0]
  record.generationToken = 'new-owner'
  release()
  const result = await attempt
  assert.equal(result.status, 'superseded')
  assert.equal(record.status, 'generating')
  assert.equal(record.generationToken, 'new-owner')
})

test('late generation failures cannot change a newer successful attempt', async () => {
  const { AudioModel, storage, records } = createFakes()
  let entered
  const enteredGeneration = new Promise((resolve) => { entered = resolve })
  let release
  const blocked = new Promise((resolve) => { release = resolve })
  const attempt = generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => { entered(); await blocked; throw new Error('obsolete failure') } })
  await enteredGeneration
  const record = [...records.values()][0]
  record.generationToken = 'newer-owner'
  record.status = 'ready'
  record.storageKey = 'newer/audio.wav'
  release()
  assert.equal((await attempt).status, 'superseded')
  assert.equal(record.status, 'ready')
  assert.equal(record.storageKey, 'newer/audio.wav')
})

test('manual and browser upload writes reject both stale success and failure updates', async () => {
  const { AudioModel, storage, records } = createFakes()
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => wav() })
  const record = [...records.values()][0]
  const identity = Object.fromEntries(['courseId', 'chapterId', 'lessonVersion', 'transcriptHash', 'model', 'voice', 'language'].map((key) => [key, record[key]]))
  record.generationToken = 'current-upload-owner'
  record.status = 'ready'
  record.storageKey = 'current/audio.wav'
  const staleSuccess = await writeOwnedTtsAudio(AudioModel, identity, 'old-browser-upload', { $set: { status: 'ready', storageKey: 'old/audio.wav' } })
  const staleFailure = await writeOwnedTtsAudio(AudioModel, identity, 'old-manual-upload', { $set: { status: 'failed', error: 'obsolete' } })
  assert.equal(staleSuccess, null)
  assert.equal(staleFailure, null)
  assert.equal(record.status, 'ready')
  assert.equal(record.storageKey, 'current/audio.wav')
})

test('only one concurrent batch worker acquires the job lease', async () => {
  const { row, options } = batchFakes()
  let summaries = 0
  options.getAudioStatus = async () => { summaries += 1; return { total: 1, ready: 1, generating: 0, failed: 0, missing: 0, stale: 0 } }
  await Promise.all([processBatch(row._id, options), processBatch(row._id, options)])
  assert.equal(summaries, 1)
  assert.equal(row.status, 'completed')
  assert.equal(row.results.length, 1)
})

test('startup recovery and a competing manual worker share the same atomic batch claim', async () => {
  const { row, options } = batchFakes({ initial: { status: 'completed', leaseUntil: null, workerToken: null } })
  let completed = 0
  options.getAudioStatus = async () => { completed += 1; return { total: 1, ready: 1, generating: 0, failed: 0, missing: 0, stale: 0 } }
  const scheduled = []
  options.schedule = (callback) => scheduled.push(callback)
  await startCourseAudioBatch('course-1', 'missing', 'admin-1', options)
  await resumeCourseAudioBatches(options)
  await Promise.all(scheduled.map((callback) => callback()))
  assert.equal(completed, 1)
  assert.equal(row.status, 'completed')
})

test('expired batch owner cannot append progress or overwrite the new owner terminal result', async () => {
  const { row, options, storage } = batchFakes()
  const entered = deferred()
  const release = deferred()
  let firstStorageCheck = true
  storage.exists = async () => {
    if (firstStorageCheck) { firstStorageCheck = false; entered.resolve(); await release.promise }
    return true
  }
  let summaries = 0
  options.getAudioStatus = async () => {
    summaries += 1
    return summaries === 1
      ? { total: 1, ready: 1, generating: 0, failed: 0, missing: 0, stale: 0 }
      : { total: 1, ready: 0, generating: 0, failed: 1, missing: 0, stale: 0 }
  }
  const oldWorker = processBatch(row._id, options)
  await entered.promise
  const oldToken = row.workerToken
  row.leaseUntil = new Date(0)
  const newWorker = processBatch(row._id, options)
  await newWorker
  assert.notEqual(row.workerToken, oldToken)
  assert.equal(row.status, 'completed')
  release.resolve()
  await oldWorker
  assert.equal(row.status, 'completed')
  assert.equal(row.results.length, 1, 'old owner cannot append a duplicate result')
})

test('abandoned running batch is recovered after its lease expires', async () => {
  const { row, options } = batchFakes({ initial: { workerToken: 'dead-worker', leaseUntil: new Date(0) } })
  await processBatch(row._id, options, { resume: true })
  assert.equal(row.status, 'completed')
  assert.equal(row.workerToken, null)
})

test('batch remains running while its claimed chapter work is blocked', async () => {
  const { row, options, storage } = batchFakes()
  const entered = deferred()
  const release = deferred()
  storage.exists = async () => { entered.resolve(); await release.promise; return true }
  const work = processBatch(row._id, options)
  await entered.promise
  assert.equal(row.status, 'running')
  assert.equal(row.completedAt, undefined)
  release.resolve()
  await work
  assert.equal(row.status, 'completed')
})

test('batch heartbeat renews the lease only for its current fenced owner', async () => {
  const { row, options, storage } = batchFakes()
  const entered = deferred()
  const release = deferred()
  storage.exists = async () => { entered.resolve(); await release.promise; return true }
  let heartbeat
  options.scheduleHeartbeat = (callback) => { heartbeat = callback; return 'heartbeat' }
  options.cancelHeartbeat = (handle) => assert.equal(handle, 'heartbeat')
  const work = processBatch(row._id, options)
  await entered.promise
  const token = row.workerToken
  const priorLease = row.leaseUntil
  await heartbeat()
  assert.equal(row.workerToken, token)
  assert.ok(row.leaseUntil > priorLease)
  release.resolve()
  await work
})

test('lesson, model, voice, and language changes produce separate cache entries', async () => {
  const { AudioModel, storage } = createFakes()
  let calls = 0
  const generateAudio = async () => { calls += 1; return wav() }
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio })
  await generateChapterAudio('course-1', lesson('Changed instructional text.'), { AudioModel, storage, env, generateAudio })
  await generateChapterAudio('course-1', lesson('Changed instructional text.'), { AudioModel, storage, env: { ...env, GEMINI_TTS_VOICE: 'Aoede' }, generateAudio })
  await generateChapterAudio('course-1', lesson('Changed instructional text.'), { AudioModel, storage, env: { ...env, GEMINI_TTS_MODEL: 'gemini-3.8-flash-tts' }, generateAudio })
  await generateChapterAudio('course-1', lesson('Changed instructional text.'), { AudioModel, storage, env: { ...env, GEMINI_TTS_LANGUAGE: 'en-GB' }, generateAudio })
  assert.equal(calls, 5)
})

test('missing stored audio is regenerated and failed forced regeneration preserves ready audio', async () => {
  const { AudioModel, storage, records, objects } = createFakes()
  let calls = 0
  const options = { AudioModel, storage, env, generateAudio: async () => { calls += 1; return wav() } }
  await generateChapterAudio('course-1', lesson(), options)
  const firstRecord = [...records.values()][0]
  const firstKey = firstRecord.chunks[0].storageKey
  await storage.delete(firstKey)
  await generateChapterAudio('course-1', lesson(), options)
  assert.equal(calls, 2)
  const current = [...records.values()][0]
  const validKey = current.chunks[0].storageKey
  await assert.rejects(generateChapterAudio('course-1', lesson(), { ...options, force: true, generateAudio: async () => { throw new Error('temporary generation failure') } }), /temporary generation failure/)
  assert.equal([...records.values()][0].status, 'ready')
  assert.equal(objects.has(validKey), true)
})

test('failed forced upload preserves the prior ready metadata even when checking the old key would fail', async () => {
  const { AudioModel, storage, records, objects } = createFakes()
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => wav() })
  const record = [...records.values()][0]
  const priorKey = record.storageKey
  const priorChunks = structuredClone(record.chunks)
  storage.exists = async () => { throw new Error('simulated HEAD 403') }
  storage.upload = async () => { throw new Error('simulated storage PUT 404') }

  await assert.rejects(generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, force: true, generateAudio: async () => wav() }), /simulated storage PUT 404/)
  assert.equal(record.status, 'ready')
  assert.equal(record.storageKey, priorKey)
  assert.deepEqual(record.chunks, priorChunks)
  assert.equal(objects.has(priorKey), true)
})

test('new failed upload records failure without publishing an unverified storage key', async () => {
  const { AudioModel, storage, records } = createFakes()
  storage.upload = async () => { throw new Error('simulated storage PUT 404') }
  await assert.rejects(generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => wav() }), /simulated storage PUT 404/)
  const record = [...records.values()][0]
  assert.equal(record.status, 'failed')
  assert.equal(record.storageKey, undefined)
  assert.equal(record.chunks, undefined)
})

test('Gemini 429 retries are bounded and a failed forced generation preserves ready metadata', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return new Response(null, { status: 429, headers: { 'retry-after': '0.001' } })
  }
  await assert.rejects(requestGeminiAudio('synthetic lesson text', { apiKey: 'synthetic-key', model: 'synthetic-model', voice: 'Kore', language: 'en-US' }), (error) => {
    assert.match(error.message, /quota or rate limit was reached after retries/)
    assert.equal(error.code, 'GEMINI_TTS_RATE_LIMIT')
    return true
  })
  assert.equal(requests, 4, 'three configured retries allow at most four requests')

  const { AudioModel, storage, records, objects } = createFakes()
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => wav() })
  const record = [...records.values()][0]
  const priorKey = record.storageKey
  const priorChunks = structuredClone(record.chunks)
  await assert.rejects(generateChapterAudio('course-1', lesson(), {
    AudioModel, storage, env, force: true,
    generateAudio: async () => { throw new Error('Gemini TTS quota or rate limit was reached after retries') },
  }), /quota or rate limit was reached after retries/)
  assert.equal(record.status, 'ready')
  assert.equal(record.storageKey, priorKey)
  assert.deepEqual(record.chunks, priorChunks)
  assert.equal(objects.has(priorKey), true)
})

test('batch stops after a Gemini 429 instead of requesting audio for every remaining chapter', async () => {
  const { row, options } = batchFakes({ mode: 'force' })
  const { AudioModel, storage, records } = createFakes()
  const chapters = curriculum.sections.flatMap((section) => section.chapters).slice(0, 2)
  let generationRequests = 0
  Object.assign(options, {
    AudioModel,
    storage,
    chapters,
    env,
    generateAudio: async () => {
      generationRequests += 1
      throw Object.assign(new Error('Gemini TTS quota or rate limit was reached after retries'), { code: 'GEMINI_TTS_RATE_LIMIT' })
    },
    getAudioStatus: async () => ({ total: 2, ready: 0, generating: 0, failed: 1, missing: 1, stale: 0 }),
  })

  await processBatch(row._id, options)
  assert.equal(generationRequests, 1, JSON.stringify(row.results))
  assert.equal(records.size, 1)
  assert.equal(row.results.length, 1)
  assert.equal(row.results[0].status, 'failed')
  assert.equal(row.status, 'completed_with_errors')
})

test('saved audio remains retrievable when the current Gemini model or voice differs', async () => {
  const { AudioModel, storage, records } = createFakes()
  const oldConfig = { ...env, GEMINI_TTS_MODEL: 'gemini-previous-model', GEMINI_TTS_VOICE: 'Aoede' }
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env: oldConfig, generateAudio: async () => wav() })
  const record = [...records.values()][0]
  AudioModel.findOne = (filter) => {
    const matching = [...records.values()].find((candidate) => Object.entries(filter).every(([key, value]) => key === 'status' ? candidate.status === value : candidate[key] === value)) || null
    return { sort() { return this }, then(resolve, reject) { return Promise.resolve(matching).then(resolve, reject) } }
  }
  const currentConfig = { ...env, GEMINI_TTS_MODEL: 'gemini-current-model', GEMINI_TTS_VOICE: 'Kore' }
  assert.equal(await isReadyChapterAudio('course-1', lesson(), { AudioModel, storage, env: currentConfig }), true)
  const saved = await loadReadyChapterAudio('course-1', lesson(), { AudioModel, storage, env: currentConfig })
  assert.equal(saved.record._id, record._id)
  assert.equal(saved.mimeType, 'audio/wav')
  assert.equal(saved.buffer.toString('ascii', 0, 4), 'RIFF')
})

test('saved audio remains playable after lesson text changes without being regenerated', async () => {
  const { AudioModel, storage, records } = createFakes()
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env, generateAudio: async () => wav() })
  const record = [...records.values()][0]
  const currentLesson = lesson('The lesson has since been revised.')
  const findMatching = (filter) => [...records.values()].find((candidate) => Object.entries(filter).every(([key, value]) => candidate[key] === value)) || null
  AudioModel.findOne = (filter) => ({ sort() { return this }, then(resolve, reject) { return Promise.resolve(findMatching(filter)).then(resolve, reject) } })

  assert.equal(await isReadyChapterAudio('course-1', currentLesson, { AudioModel, storage, env }), true)
  const saved = await loadReadyChapterAudio('course-1', currentLesson, { AudioModel, storage, env })
  assert.equal(saved.record._id, record._id)
  assert.equal(saved.buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(records.size, 1, 'playback must not generate a replacement recording')
})

test('playback skips a newer stale record whose object is missing and uses an older stored Gemini recording', async () => {
  const { AudioModel, storage, records } = createFakes()
  const olderEnv = { ...env, GEMINI_TTS_VOICE: 'Aoede' }
  const newerEnv = { ...env, GEMINI_TTS_VOICE: 'Kore' }
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env: olderEnv, generateAudio: async () => wav() })
  const olderRecord = [...records.values()][0]
  olderRecord.updatedAt = new Date('2025-01-01T00:00:00.000Z')
  await generateChapterAudio('course-1', lesson(), { AudioModel, storage, env: newerEnv, generateAudio: async () => wav() })
  const newerRecord = [...records.values()].find((record) => record.voice === 'Kore')
  newerRecord.updatedAt = new Date('2026-01-01T00:00:00.000Z')
  await storage.delete(newerRecord.chunks[0].storageKey)

  const result = await loadReadyChapterAudio('course-1', lesson(), { AudioModel, storage, env: newerEnv })
  assert.equal(result.record._id, olderRecord._id)
  assert.equal(await storage.exists(olderRecord.chunks[0].storageKey), true)
})
