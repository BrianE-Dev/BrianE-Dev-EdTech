import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtsStorage, TtsStorageError } from '../backend/src/services/ttsStorage.js'

const storageEnv = {
  NODE_ENV: 'production',
  TTS_STORAGE_PROVIDER: 's3',
  TTS_S3_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  TTS_S3_BUCKET: 'audio-test',
  TTS_S3_REGION: 'auto',
  TTS_S3_ACCESS_KEY_ID: 'synthetic-access-key',
  TTS_S3_SECRET_ACCESS_KEY: 'synthetic-secret-key',
}

test('persistent storage configuration failures use a safe service-unavailable error', async () => {
  assert.throws(() => createTtsStorage({ ...storageEnv, TTS_S3_SECRET_ACCESS_KEY: '' }), (error) => {
    assert.ok(error instanceof TtsStorageError)
    assert.equal(error.status, 503)
    assert.equal(error.code, 'AUDIO_STORAGE_UNAVAILABLE')
    assert.doesNotMatch(error.message, /synthetic|account-id|audio-test/i)
    return true
  })
})

test('persistent storage access failures never include endpoint credentials in the public error', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('network failed for https://synthetic-secret-key@example.invalid') }
  const storage = createTtsStorage(storageEnv)
  await assert.rejects(storage.exists('brianedev/tts/course/chapter/audio.wav'), (error) => {
    assert.equal(error.status, 503)
    assert.equal(error.code, 'AUDIO_STORAGE_UNAVAILABLE')
    assert.equal(error.message, 'Persistent audio storage is unavailable')
    return true
  })
})

test('missing persistent objects remain distinguishable from storage errors', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(null, { status: 404 })
  const storage = createTtsStorage(storageEnv)
  assert.equal(await storage.exists('brianedev/tts/course/chapter/audio.wav'), false)
})
