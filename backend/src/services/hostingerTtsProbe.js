import net from 'node:net'
import { classifyTtsDiagnosticStorageError, resolveMongoDatabaseSelection } from './ttsRecoveryDiagnostic.js'

const TARGET_COURSE_ID = '6ac7817fdb24a6d43b730fed'
const TARGET_CHAPTER_ID = 'chapter-handling-larger-development-tasks'

function isLocalOrPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  const family = net.isIP(host)
  if (family === 4) {
    const [a, b] = host.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168
  }
  if (family === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
  return false
}

export function getHostingerTtsRuntimeConfig(env) {
  if (env.NODE_ENV !== 'production' || env.HOSTINGER_RUNTIME !== '1') {
    throw new Error('Refusing to run: expected Hostinger production runtime variables are not present.')
  }
  const uri = env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Refusing to run: runtime MONGODB_URI is not configured.')
  let parsed
  try {
    parsed = new URL(uri)
  } catch {
    throw new Error('Refusing to run: runtime MONGODB_URI is invalid.')
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error('Refusing to run: MongoDB host is not an allowed remote production host.')
  }
  const selection = resolveMongoDatabaseSelection(uri)
  if (!selection.database) throw new Error('Refusing to run: runtime MongoDB URI must explicitly select its database.')
  return { uri, mongoHost: parsed.hostname, database: selection.database }
}

export function determineStoredCourseIdType(documents, targetCourseId = TARGET_COURSE_ID) {
  const targetDocuments = documents.filter((document) => String(document.courseId) === targetCourseId)
  const types = [...new Set(targetDocuments.map(({ courseId }) => {
    if (typeof courseId === 'string') return 'string'
    if (courseId?._bsontype === 'ObjectId') return 'objectId'
    return typeof courseId
  }))]
  if (types.length !== 1 || !types[0]) {
    throw new Error(types.length > 1
      ? 'Refusing to run: target course records have mixed stored courseId types.'
      : 'Refusing to run: no sample record for the target course and chapter was found to confirm courseId type.')
  }
  return { type: types[0], value: targetDocuments[0].courseId }
}

export function summarizeTtsStorageConfig(env) {
  const provider = env.TTS_STORAGE_PROVIDER || (env.NODE_ENV === 'production' ? 's3' : 'local')
  let endpointHostname = '(unset)'
  if (env.TTS_S3_ENDPOINT?.trim()) {
    try {
      endpointHostname = new URL(env.TTS_S3_ENDPOINT.trim()).hostname
    } catch { endpointHostname = '(invalid)' }
  } else if (env.TTS_S3_REGION?.trim()) {
    endpointHostname = `s3.${env.TTS_S3_REGION.trim()}.amazonaws.com`
  }
  return {
    provider,
    endpointHostname,
    bucket: env.TTS_S3_BUCKET?.trim() || '(unset)',
    region: env.TTS_S3_REGION?.trim() || '(unset)',
    keyPrefix: 'brianedev/tts/',
  }
}

export function classifyHostingerStorageProbeError(error) {
  const classification = classifyTtsDiagnosticStorageError(error)
  if (classification === 'authentication_error') return 'permission_or_authentication'
  if (classification === 'permission_error') return 'permission_or_authentication'
  if (['dns_error', 'tls_error', 'timeout', 'connection_error'].includes(classification)) return 'network'
  if (classification === 'missing_object') return 'missing_object'
  return 'other_storage_error'
}

export async function checkHostingerTtsRecordObjects(record, storage) {
  const counts = { accessible: 0, missing: 0, permissionOrAuthentication: 0, network: 0, otherErrors: 0 }
  for (const chunk of record.chunks || []) {
    try {
      if (await storage.exists(chunk.storageKey)) counts.accessible += 1
      else counts.missing += 1
    } catch (error) {
      const category = classifyHostingerStorageProbeError(error)
      if (category === 'permission_or_authentication') counts.permissionOrAuthentication += 1
      else if (category === 'network') counts.network += 1
      else counts.otherErrors += 1
    }
  }
  return { chunkCount: (record.chunks || []).length, ...counts }
}

export const hostingerTtsProbeTarget = Object.freeze({ courseId: TARGET_COURSE_ID, chapterId: TARGET_CHAPTER_ID })
