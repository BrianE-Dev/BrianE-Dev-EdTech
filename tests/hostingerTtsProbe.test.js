import assert from 'node:assert/strict'
import test from 'node:test'
import { checkHostingerTtsRecordObjects, determineStoredCourseIdType, getHostingerTtsRuntimeConfig, summarizeTtsStorageConfig } from '../backend/src/services/hostingerTtsProbe.js'

const target = '6ac7817fdb24a6d43b730fed'
const runtimeEnv = {
  NODE_ENV: 'production',
  HOSTINGER_RUNTIME: '1',
  MONGODB_URI: 'mongodb+srv://private-user:private-password@cluster.example.invalid/briane_prod',
}

test('Hostinger diagnostic requires runtime marker, production mode, explicit remote database, and never loads local config', () => {
  const runtime = getHostingerTtsRuntimeConfig(runtimeEnv)
  assert.equal(runtime.mongoHost, 'cluster.example.invalid')
  assert.equal(runtime.uri, runtimeEnv.MONGODB_URI)
  assert.throws(() => getHostingerTtsRuntimeConfig({ ...runtimeEnv, HOSTINGER_RUNTIME: '' }), /Hostinger production runtime variables/)
  assert.throws(() => getHostingerTtsRuntimeConfig({ ...runtimeEnv, NODE_ENV: 'development' }), /Hostinger production runtime variables/)
  assert.throws(() => getHostingerTtsRuntimeConfig({ ...runtimeEnv, MONGODB_URI: 'mongodb://localhost/test' }), /not an allowed remote production host/)
  assert.throws(() => getHostingerTtsRuntimeConfig({ ...runtimeEnv, MONGODB_URI: 'mongodb://127.0.0.1/test' }), /not an allowed remote production host/)
  assert.throws(() => getHostingerTtsRuntimeConfig({ ...runtimeEnv, MONGODB_URI: 'mongodb+srv://cluster.example.invalid/' }), /not an allowed remote production host|database/i)
})

test('diagnostic confirms the stored courseId BSON type before exact course query', () => {
  assert.deepEqual(determineStoredCourseIdType([{ courseId: target }]), { type: 'string', value: target })
  const fakeObjectId = { _bsontype: 'ObjectId', toString: () => target }
  assert.deepEqual(determineStoredCourseIdType([{ courseId: fakeObjectId }]), { type: 'objectId', value: fakeObjectId })
  assert.throws(() => determineStoredCourseIdType([{ courseId: 'other-course' }]), /no sample record/)
  assert.throws(() => determineStoredCourseIdType([{ courseId: target }, { courseId: { _bsontype: 'ObjectId', toString: () => target } }]), /mixed stored courseId types/)
})

test('sanitized Hostinger storage configuration reports host and prefix without secrets', () => {
  const result = summarizeTtsStorageConfig({
    NODE_ENV: 'production',
    TTS_STORAGE_PROVIDER: 's3',
    TTS_S3_ENDPOINT: 'https://account.r2.example.invalid/custom/path',
    TTS_S3_BUCKET: 'course-audio',
    TTS_S3_REGION: 'auto',
    TTS_S3_ACCESS_KEY_ID: 'access-secret',
    TTS_S3_SECRET_ACCESS_KEY: 'secret-secret',
  })
  assert.deepEqual(result, { provider: 's3', endpointHostname: 'account.r2.example.invalid', bucket: 'course-audio', region: 'auto', keyPrefix: 'brianedev/tts/' })
  assert.doesNotMatch(JSON.stringify(result), /access-secret|secret-secret|custom\/path/)
})

test('read-only chunk probe distinguishes accessible, missing, permission, and network errors', async () => {
  const keys = ['present', 'missing', 'forbidden', 'offline']
  let calls = 0
  const result = await checkHostingerTtsRecordObjects({ chunks: keys.map((storageKey) => ({ storageKey })) }, {
    async exists(key) {
      calls += 1
      if (key === 'present') return true
      if (key === 'missing') return false
      const cause = key === 'forbidden' ? new Error('Object check failed (403)') : Object.assign(new Error('network down'), { code: 'ETIMEDOUT' })
      throw Object.assign(new Error('safe wrapper', { cause }), { code: 'AUDIO_STORAGE_UNAVAILABLE' })
    },
    async upload() { throw new Error('must not upload') },
    async delete() { throw new Error('must not delete') },
  })
  assert.equal(calls, 4)
  assert.deepEqual(result, { chunkCount: 4, accessible: 1, missing: 1, permissionOrAuthentication: 1, network: 1, otherErrors: 0 })
  assert.equal(target.length, 24)
})
