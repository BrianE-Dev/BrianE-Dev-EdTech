import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
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

test('R2 upload builds a path-style URL and a valid SigV4 signature with fake credentials', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  let requestedUrl
  let requestOptions
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url)
    requestOptions = options
    return new Response(null, { status: 200 })
  }

  const endpoint = 'https://account-id.eu.r2.cloudflarestorage.com'
  const body = Buffer.from('synthetic audio bytes')
  const storage = createTtsStorage({ ...storageEnv, TTS_S3_ENDPOINT: endpoint })
  await storage.upload('brianedev/tts/course/chapter/audio file.wav', body, 'audio/wav')

  assert.equal(requestedUrl.origin, endpoint)
  assert.equal(requestedUrl.pathname, '/audio-test/brianedev/tts/course/chapter/audio%20file.wav')
  assert.equal(requestedUrl.search, '')
  assert.equal(requestOptions.method, 'PUT')
  assert.deepEqual(requestOptions.body, body)

  const headers = requestOptions.headers
  const date = headers['x-amz-date'].slice(0, 8)
  const scope = `${date}/auto/s3/aws4_request`
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  assert.equal(headers['x-amz-content-sha256'], createHash('sha256').update(body).digest('hex'))
  const canonicalHeaders = [
    `content-type:${headers['content-type']}`,
    `host:${headers.host}`,
    `x-amz-content-sha256:${headers['x-amz-content-sha256']}`,
    `x-amz-date:${headers['x-amz-date']}`,
  ].map((line) => `${line}\n`).join('')
  const canonicalRequest = ['PUT', requestedUrl.pathname, '', canonicalHeaders, signedHeaders, headers['x-amz-content-sha256']].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', headers['x-amz-date'], scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
  const hmac = (key, value) => createHmac('sha256', key).update(value, 'utf8').digest()
  const dateKey = hmac(`AWS4${storageEnv.TTS_S3_SECRET_ACCESS_KEY}`, date)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const expectedSignature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')
  assert.equal(headers.authorization, `AWS4-HMAC-SHA256 Credential=${storageEnv.TTS_S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${expectedSignature}`)
})

test('S3 storage distinguishes HEAD absence from failed PUT and GET requests', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(null, { status: 404 })
  const storage = createTtsStorage(storageEnv)
  const key = 'brianedev/tts/course/chapter/audio.wav'

  assert.equal(await storage.exists(key), false)
  await assert.rejects(storage.upload(key, Buffer.from('audio')), (error) => {
    assert.ok(error instanceof TtsStorageError)
    assert.equal(error.operation, 'PUT')
    assert.equal(error.httpStatus, 404)
    assert.equal(error.cause.message, 'Object upload failed (404)')
    return true
  })
  await assert.rejects(storage.read(key), (error) => {
    assert.ok(error instanceof TtsStorageError)
    assert.equal(error.operation, 'GET')
    assert.equal(error.httpStatus, 404)
    assert.equal(error.cause.message, 'Object read failed (404)')
    return true
  })
})

test('S3 storage retains only recognized provider error codes from XML responses', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response('<Error><Code>NoSuchKey</Code><Message>Not found</Message></Error>', { status: 404 })
  const storage = createTtsStorage(storageEnv)
  await assert.rejects(storage.read('brianedev/tts/course/chapter/audio.wav'), (error) => {
    assert.equal(error.operation, 'GET')
    assert.equal(error.httpStatus, 404)
    assert.equal(error.providerCode, 'NoSuchKey')
    assert.doesNotMatch(JSON.stringify(error), /Message|Not found/)
    return true
  })
})
