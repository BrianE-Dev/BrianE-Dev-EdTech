import { createHash, createHmac } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const localRoot = fileURLToPath(new URL('../../.local-tts/', import.meta.url))

function safeKey(key) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('\\') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('TTS storage key is invalid')
  }
  return key
}

function createLocalStorage() {
  function fileFor(key) {
    const resolved = path.resolve(localRoot, safeKey(key))
    if (!resolved.startsWith(`${path.resolve(localRoot)}${path.sep}`)) throw new Error('TTS storage key is invalid')
    return resolved
  }
  return {
    async exists(key) { try { return (await stat(fileFor(key))).isFile() } catch (error) { if (error.code === 'ENOENT') return false; throw error } },
    async upload(key, buffer) { const file = fileFor(key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, buffer) },
    async read(key) { return readFile(fileFor(key)) },
    async delete(key) { await rm(fileFor(key), { force: true }) },
  }
}

function awsSigningKey(secret, date, region) {
  const dateKey = createHmac('sha256', `AWS4${secret}`).update(date, 'utf8').digest()
  const regionKey = createHmac('sha256', dateKey).update(region, 'utf8').digest()
  const serviceKey = createHmac('sha256', regionKey).update('s3', 'utf8').digest()
  return createHmac('sha256', serviceKey).update('aws4_request', 'utf8').digest()
}

function createS3Storage(env = process.env) {
  const bucket = env.TTS_S3_BUCKET?.trim()
  const region = env.TTS_S3_REGION?.trim()
  const accessKey = env.TTS_S3_ACCESS_KEY_ID?.trim()
  const secretKey = env.TTS_S3_SECRET_ACCESS_KEY?.trim()
  const endpoint = env.TTS_S3_ENDPOINT?.trim()
  if (!bucket || !region || !accessKey || !secretKey) throw new Error('TTS S3 storage requires TTS_S3_BUCKET, TTS_S3_REGION, TTS_S3_ACCESS_KEY_ID, and TTS_S3_SECRET_ACCESS_KEY')
  const baseUrl = new URL(endpoint || `https://s3.${region}.amazonaws.com`)
  if (baseUrl.protocol !== 'https:') throw new Error('TTS_S3_ENDPOINT must use HTTPS')

  async function request(method, key, body, mimeType) {
    const clean = safeKey(key)
    const objectUrl = new URL(baseUrl)
    const pathParts = [...objectUrl.pathname.split('/').filter(Boolean), bucket, ...clean.split('/')]
    objectUrl.pathname = `/${pathParts.map((part) => encodeURIComponent(part)).join('/')}`
    objectUrl.search = ''
    objectUrl.hash = ''

    const payloadHash = createHash('sha256').update(body || Buffer.alloc(0)).digest('hex')
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const date = amzDate.slice(0, 8)
    const headers = {
      host: objectUrl.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(mimeType ? { 'content-type': mimeType } : {}),
    }
    const signedHeaders = Object.keys(headers).sort().join(';')
    const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join('')
    const canonicalRequest = [method, objectUrl.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const scope = `${date}/${region}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
    const signature = createHmac('sha256', awsSigningKey(secretKey, date, region)).update(stringToSign).digest('hex')
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    const response = await fetch(objectUrl, { method, headers: { ...headers, authorization }, body: method === 'PUT' ? body : undefined })
    return response
  }

  return {
    async exists(key) { const response = await request('HEAD', key); if (response.status === 404) return false; if (!response.ok) throw new Error(`TTS object storage check failed (${response.status})`); return true },
    async upload(key, buffer, mimeType = 'audio/wav') { const response = await request('PUT', key, buffer, mimeType); if (!response.ok) throw new Error(`TTS object storage upload failed (${response.status})`) },
    async read(key) { const response = await request('GET', key); if (!response.ok) throw new Error(response.status === 404 ? 'TTS object is missing' : `TTS object storage read failed (${response.status})`); return Buffer.from(await response.arrayBuffer()) },
    async delete(key) { const response = await request('DELETE', key); if (!response.ok && response.status !== 404) throw new Error(`TTS object storage delete failed (${response.status})`) },
  }
}

export function createTtsStorage(env = process.env) {
  const provider = env.TTS_STORAGE_PROVIDER || (env.NODE_ENV === 'production' ? 's3' : 'local')
  if (provider === 'local') {
    if (env.NODE_ENV === 'production') throw new Error('Local TTS storage is disabled in production; configure persistent S3-compatible storage')
    return createLocalStorage()
  }
  if (provider === 's3') return createS3Storage(env)
  throw new Error('TTS_STORAGE_PROVIDER must be local or s3')
}
