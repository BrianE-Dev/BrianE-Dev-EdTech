import crypto from 'node:crypto'
import { TtsAudio, TtsBatchJob } from '../models/index.js'
import { curriculum } from '../../../src/data/curriculum.js'
import { getLessonByChapterId } from './lessonRepository.js'
import { buildTtsTranscript, hashTranscript } from './ttsTranscript.js'
import { createTtsStorage } from './ttsStorage.js'

const CHUNK_LIMIT = Math.max(500, Math.min(3000, Number(process.env.GEMINI_TTS_CHUNK_CHARS) || 1800))
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.GEMINI_TTS_REQUEST_DELAY_MS) || 15000)
const MAX_RATE_LIMIT_RETRIES = 3
const STALE_GENERATION_MS = 15 * 60 * 1000
const ttsStyle = 'Clear, friendly, professional instructional narration. Speak at a steady, natural pace.'

function ttsConfig(env = process.env, { requireApiKey = true } = {}) {
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (requireApiKey && !apiKey) throw new Error('Gemini TTS is not configured (GEMINI_API_KEY is missing)')
  const model = env.GEMINI_TTS_MODEL?.trim() || 'gemini-3.8-flash-lite-tts'
  const voice = env.GEMINI_TTS_VOICE?.trim() || 'Kore'
  const language = env.GEMINI_TTS_LANGUAGE?.trim() || 'en-US'
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(model) || !/^[a-zA-Z0-9._-]{1,120}$/.test(voice) || !/^[a-zA-Z0-9-]{2,32}$/.test(language)) {
    throw new Error('Gemini TTS model, voice, or language configuration is invalid')
  }
  return { apiKey, model, voice, language }
}

function safeComponent(value) {
  const safe = String(value).replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!safe || safe === '.' || safe === '..') throw new Error('TTS storage identity is invalid')
  return safe
}

function splitLongParagraph(paragraph, limit) {
  if (paragraph.length <= limit) return [paragraph]
  const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph]
  const parts = []
  let current = ''
  for (const sentence of sentences) {
    const text = sentence.trim()
    if (current && current.length + text.length + 1 > limit) { parts.push(current); current = '' }
    if (text.length <= limit) current = current ? `${current} ${text}` : text
    else {
      for (let offset = 0; offset < text.length; offset += limit) parts.push(text.slice(offset, offset + limit).trim())
    }
  }
  if (current) parts.push(current)
  return parts
}

export function splitTtsTranscript(transcript, limit = CHUNK_LIMIT) {
  const paragraphs = transcript.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const chunks = []
  let current = ''
  for (const paragraph of paragraphs.flatMap((item) => splitLongParagraph(item, limit))) {
    if (current && current.length + paragraph.length + 2 > limit) { chunks.push(current); current = '' }
    current = current ? `${current}\n\n${paragraph}` : paragraph
  }
  if (current) chunks.push(current)
  return chunks
}

export function combineWavBuffers(waves) {
  if (!waves.length) throw new Error('Gemini returned no audio chunks')
  const pcmParts = []
  for (const wave of waves) {
    if (wave.toString('ascii', 0, 4) !== 'RIFF' || wave.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Gemini returned an unsupported audio format')
    let offset = 12
    let format = null
    let pcm = null
    while (offset + 8 <= wave.length) {
      const tag = wave.toString('ascii', offset, offset + 4)
      const size = wave.readUInt32LE(offset + 4)
      const start = offset + 8
      if (start + size > wave.length) throw new Error('Gemini returned an incomplete WAV chunk')
      if (tag === 'fmt ') format = wave.subarray(start, start + size)
      if (tag === 'data') pcm = wave.subarray(start, start + size)
      offset = start + size + (size % 2)
    }
    if (!format || !pcm || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt32LE(4) !== 24000 || format.readUInt16LE(14) !== 16) {
      throw new Error('Gemini returned an unsupported WAV encoding')
    }
    pcmParts.push(pcm)
  }
  const pcm = Buffer.concat(pcmParts)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function requestGeminiAudio(text, config) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`
  let response
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text, speech_metadata: { style: ttsStyle } }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { languageCode: config.language, voiceConfig: { voice: config.voice } },
          },
        }),
        signal: AbortSignal.timeout(120000),
      })
    } catch {
      throw new Error('Gemini TTS request could not reach the speech service')
    }
    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) break
    const retryAfter = Number(response.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 120000) : REQUEST_DELAY_MS * (attempt + 1)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  if (!response.ok) {
    const reason = response.status === 429 ? 'Gemini TTS quota or rate limit was reached after retries' : response.status === 401 || response.status === 403 ? 'Gemini TTS credentials were rejected' : `Gemini TTS request failed (${response.status})`
    throw new Error(reason)
  }
  const result = await response.json()
  const audio = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData
  if (!audio?.data || (audio.mimeType && !audio.mimeType.startsWith('audio/'))) throw new Error('Gemini TTS response did not contain audio')
  return Buffer.from(audio.data, 'base64')
}

function identityFor(courseId, lesson, transcriptHash, config) {
  return {
    courseId: String(courseId),
    chapterId: lesson.chapterId,
    lessonVersion: lesson.contentVersion,
    transcriptHash,
    model: config.model,
    voice: config.voice,
    language: config.language,
  }
}

async function audioExists(record, storage) {
  return Boolean(record?.chunks?.length && await Promise.all(record.chunks.map((chunk) => storage.exists(chunk.storageKey))).then((results) => results.every(Boolean)))
}

function storagePrefix(identity, generationId) {
  return [
    'brianedev', 'tts', safeComponent(identity.courseId), safeComponent(identity.chapterId),
    safeComponent(identity.transcriptHash), safeComponent(identity.model), safeComponent(identity.voice),
    safeComponent(identity.language), 'versions', generationId,
  ].join('/')
}

export async function generateChapterAudio(courseId, lesson, { generatedBy, force = false, AudioModel = TtsAudio, storage = createTtsStorage(), env = process.env, generateAudio = requestGeminiAudio } = {}) {
  const transcript = buildTtsTranscript(lesson)
  if (!transcript) throw new Error('Lesson has no narratable content')
  const transcriptHash = hashTranscript(transcript)
  const config = ttsConfig(env)
  const identity = identityFor(courseId, lesson, transcriptHash, config)
  const current = await AudioModel.findOne(identity)
  if (!force && current?.status === 'ready' && await audioExists(current, storage)) return { status: 'ready', cacheHit: true, chapterId: lesson.chapterId, transcriptHash, chunkCount: current.chunkCount }

  const cutoff = new Date(Date.now() - STALE_GENERATION_MS)
  let claimed
  try {
    claimed = await AudioModel.findOneAndUpdate({
      ...identity,
      $or: [{ status: { $ne: 'generating' } }, { updatedAt: { $lt: cutoff } }],
    }, {
      $setOnInsert: identity,
      $set: { status: 'generating', generatedBy, error: null, generationStartedAt: new Date(), lastAttemptAt: new Date() },
    }, { upsert: true, new: true, setDefaultsOnInsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    const inProgress = await AudioModel.findOne(identity)
    if (inProgress?.status === 'generating') return { status: 'generating', cacheHit: false, chapterId: lesson.chapterId, transcriptHash }
    throw error
  }
  if (!claimed || (claimed.status === 'generating' && current?.status === 'generating' && current.updatedAt >= cutoff)) {
    return { status: 'generating', cacheHit: false, chapterId: lesson.chapterId, transcriptHash }
  }

  const previous = current?.status === 'ready' && await audioExists(current, storage) ? current : null
  try {
    const chunks = splitTtsTranscript(transcript)
    const generated = []
    for (let index = 0; index < chunks.length; index += 1) {
      if (index > 0 && REQUEST_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
      generated.push(await generateAudio(chunks[index], config))
    }
    const combined = combineWavBuffers(generated)
    const generationId = crypto.randomUUID()
    const prefix = storagePrefix(identity, generationId)
    const chunkRecords = []
    for (let index = 0; index < generated.length; index += 1) {
      const key = `${prefix}/chunk-${String(index + 1).padStart(3, '0')}.wav`
      await storage.upload(key, generated[index], 'audio/wav')
      chunkRecords.push({ order: index + 1, storageKey: key, mimeType: 'audio/wav', durationSeconds: Math.round(generated[index].length / 48000) })
    }
    const ready = await AudioModel.findOneAndUpdate(identity, { $set: {
      status: 'ready', storageKey: chunkRecords[0].storageKey, chunks: chunkRecords, mimeType: 'audio/wav',
      durationSeconds: Math.round(combined.length / 48000), chunkCount: chunkRecords.length,
      generationCompletedAt: new Date(), generatedBy, error: null,
    } }, { new: true })
    return { status: 'ready', cacheHit: false, chapterId: lesson.chapterId, transcriptHash, chunkCount: ready.chunkCount }
  } catch (error) {
    const message = error.message?.slice(0, 450) || 'Audio generation failed'
    await AudioModel.findOneAndUpdate(identity, { $set: previous
      ? { status: 'ready', storageKey: previous.storageKey, chunks: previous.chunks, mimeType: previous.mimeType, durationSeconds: previous.durationSeconds, chunkCount: previous.chunkCount, error: message }
      : { status: 'failed', error: message },
    }, { new: true })
    throw error
  }
}

export async function loadReadyChapterAudio(courseId, lesson, { AudioModel = TtsAudio, storage = createTtsStorage(), env = process.env } = {}) {
  const transcript = buildTtsTranscript(lesson)
  const identity = identityFor(courseId, lesson, hashTranscript(transcript), ttsConfig(env, { requireApiKey: false }))
  const record = await AudioModel.findOne(identity)
  if (!record || record.status !== 'ready' || !await audioExists(record, storage)) return null
  const ordered = [...record.chunks].sort((left, right) => left.order - right.order)
  const buffers = await Promise.all(ordered.map((chunk) => storage.read(chunk.storageKey)))
  return { buffer: combineWavBuffers(buffers), mimeType: record.mimeType || 'audio/wav', record }
}

export async function isReadyChapterAudio(courseId, lesson, { AudioModel = TtsAudio, storage = createTtsStorage(), env = process.env } = {}) {
  const transcript = buildTtsTranscript(lesson)
  const identity = identityFor(courseId, lesson, hashTranscript(transcript), ttsConfig(env, { requireApiKey: false }))
  const record = await AudioModel.findOne(identity)
  return Boolean(record?.status === 'ready' && await audioExists(record, storage))
}

export async function getCourseAudioStatus(courseId, { AudioModel = TtsAudio, storage = createTtsStorage(), env = process.env } = {}) {
  const chapters = curriculum.sections.flatMap((section) => section.chapters)
  const counts = { total: chapters.length, ready: 0, generating: 0, failed: 0, missing: 0, stale: 0 }
  const chapterStatuses = []
  const config = ttsConfig(env, { requireApiKey: false })
  for (const chapter of chapters) {
    const { lesson, transcriptHash } = await (async () => {
      const lesson = await getLessonByChapterId(chapter.id)
      const transcript = buildTtsTranscript(lesson)
      return { lesson, transcript, transcriptHash: hashTranscript(transcript) }
    })()
    const identity = identityFor(courseId, lesson, transcriptHash, config)
    const record = await AudioModel.findOne(identity)
    let status = 'missing'
    if (record?.status === 'generating') status = 'generating'
    else if (record?.status === 'failed') status = 'failed'
    else if (record?.status === 'ready') status = await audioExists(record, storage) ? 'ready' : 'stale'
    else {
      const old = await AudioModel.findOne({ courseId: String(courseId), chapterId: chapter.id }).sort({ updatedAt: -1 })
      if (old) status = 'stale'
    }
    counts[status] += 1
    chapterStatuses.push({ chapterId: chapter.id, number: chapter.number, title: chapter.title, status, error: record?.error || '' })
  }
  const batch = await TtsBatchJob.findOne({ courseId: String(courseId) }).lean()
  return { ...counts, chapters: chapterStatuses, batch: batch ? {
    status: batch.status, mode: batch.mode, currentChapterId: batch.currentChapterId || null,
    startedAt: batch.startedAt || null, completedAt: batch.completedAt || null,
  } : null }
}

async function processBatch(jobId, { BatchModel = TtsBatchJob, AudioModel = TtsAudio, storage = createTtsStorage(), env = process.env } = {}, { resume = false } = {}) {
  const job = await BatchModel.findById(jobId)
  if (!job || job.status !== 'running') return
  const chapters = curriculum.sections.flatMap((section) => section.chapters)
  for (const chapter of chapters) {
    const latest = await BatchModel.findById(jobId)
    if (!latest || latest.status !== 'running') return
    await BatchModel.updateOne({ _id: jobId, status: 'running' }, { $set: { currentChapterId: chapter.id } })
    try {
      const priorResult = latest.results?.find((item) => item.chapterId === chapter.id && ['ready', 'cached', 'skipped_existing'].includes(item.status))
      if (resume && priorResult) continue
      const lesson = await getLessonByChapterId(chapter.id)
      if (job.mode === 'missing') {
        const anyReady = await AudioModel.findOne({ courseId: String(job.courseId), chapterId: chapter.id, status: 'ready' }).sort({ updatedAt: -1 })
        if (anyReady && await audioExists(anyReady, storage)) {
          await BatchModel.updateOne({ _id: jobId, status: 'running' }, { $push: { results: { chapterId: chapter.id, status: 'skipped_existing' } } })
          continue
        }
      }
      const result = await generateChapterAudio(job.courseId, lesson, { generatedBy: job.initiatedBy, force: job.mode === 'force', AudioModel, storage, env })
      await BatchModel.updateOne({ _id: jobId, status: 'running' }, { $push: { results: { chapterId: chapter.id, status: result.status === 'generating' ? 'skipped' : result.cacheHit ? 'cached' : 'ready' } } })
    } catch (error) {
      await BatchModel.updateOne({ _id: jobId, status: 'running' }, { $push: { results: { chapterId: chapter.id, status: 'failed', error: error.message.slice(0, 450) } } })
    }
  }
  const summary = await getCourseAudioStatus(job.courseId, { AudioModel, storage, env })
  await BatchModel.findByIdAndUpdate(jobId, { $set: {
    status: summary.failed || summary.missing || summary.generating ? 'completed_with_errors' : 'completed',
    total: summary.total, ready: summary.ready, generating: summary.generating, failed: summary.failed,
    missing: summary.missing, stale: summary.stale, currentChapterId: null, completedAt: new Date(),
  } })
}

export async function startCourseAudioBatch(courseId, mode, initiatedBy, options = {}) {
  const BatchModel = options.BatchModel || TtsBatchJob
  const existing = await BatchModel.findOne({ courseId: String(courseId), status: 'running' })
  if (existing) return { job: existing, alreadyRunning: true }
  const now = new Date()
  let job
  try {
    job = await BatchModel.findOneAndUpdate({ courseId: String(courseId), status: { $ne: 'running' } }, {
      $set: { status: 'running', mode, initiatedBy, total: curriculum.sections.reduce((sum, section) => sum + section.chapters.length, 0), ready: 0, generating: 0, failed: 0, missing: 0, stale: 0, currentChapterId: null, results: [], startedAt: now, completedAt: null },
    }, { new: true, upsert: true, setDefaultsOnInsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    const running = await BatchModel.findOne({ courseId: String(courseId), status: 'running' })
    if (running) return { job: running, alreadyRunning: true }
    throw error
  }
  setImmediate(() => processBatch(job._id, options).catch(async () => {
    await BatchModel.findByIdAndUpdate(job._id, { $set: { status: 'failed', completedAt: new Date(), currentChapterId: null } })
  }))
  return { job, alreadyRunning: false }
}

export async function resumeCourseAudioBatches() {
  const running = await TtsBatchJob.find({ status: 'running' }).lean()
  for (const job of running) setImmediate(() => processBatch(job._id, {}, { resume: true }).catch(async () => {
    await TtsBatchJob.findByIdAndUpdate(job._id, { $set: { status: 'failed', completedAt: new Date(), currentChapterId: null } })
  }))
}
