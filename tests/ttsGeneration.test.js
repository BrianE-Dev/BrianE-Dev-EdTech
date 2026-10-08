import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTtsTranscript, hashTranscript } from '../backend/src/services/ttsTranscript.js'
import { combineWavBuffers, generateChapterAudio, splitTtsTranscript } from '../backend/src/services/ttsGeneration.js'

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
    async findOneAndUpdate(filter, update) {
      const identity = Object.fromEntries(Object.entries(filter).filter(([key]) => key !== '$or'))
      const key = keyFor(identity)
      const existing = records.get(key)
      if (existing?.status === 'generating' && update.$set?.status === 'generating') return null
      const record = existing || { ...structuredClone(update.$setOnInsert), _id: `audio-${records.size + 1}` }
      Object.assign(record, structuredClone(update.$set), { updatedAt: new Date() })
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
