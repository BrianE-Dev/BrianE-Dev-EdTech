import { Resolver } from 'node:dns'
import net from 'node:net'
import tls from 'node:tls'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config({ path: fileURLToPath(new URL('../backend/.env', import.meta.url)) })

const TIMEOUT_MS = 5_000
const uri = process.env.MONGODB_URI?.trim()

function errorCode(error) {
  const code = String(error?.code || error?.name || 'UNKNOWN')
  return /^(ENOTFOUND|ENODATA|EAI_AGAIN|ETIMEOUT|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ERR_SSL_[A-Z0-9_]+|ERR_TLS_[A-Z0-9_]+|MongoNetworkError|Error)$/.test(code)
    ? code
    : 'OTHER'
}

function resolveDns(method, ...args) {
  const resolver = new Resolver()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolver.cancel()
      reject(Object.assign(new Error('diagnostic timeout'), { code: 'ETIMEDOUT' }))
    }, TIMEOUT_MS)
    resolver[method](...args, (error, records) => {
      clearTimeout(timer)
      resolver.cancel()
      if (error) reject(error)
      else resolve(records)
    })
  })
}

async function resolveAddresses(host) {
  const [ipv4, ipv6] = await Promise.all([
    resolveDns('resolve4', host).then((records) => ({ records, error: null }), (error) => ({ records: [], error })),
    resolveDns('resolve6', host).then((records) => ({ records, error: null }), (error) => ({ records: [], error })),
  ])
  const addresses = [
    ...ipv4.records.map((address) => ({ address, family: 4 })),
    ...ipv6.records.map((address) => ({ address, family: 6 })),
  ]
  if (addresses.length) return addresses
  const error = [ipv4.error, ipv6.error].find((item) => item?.code !== 'ENODATA') || ipv4.error || ipv6.error
  throw error || Object.assign(new Error('no DNS address records'), { code: 'ENODATA' })
}

function testTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(TIMEOUT_MS, () => finish({ status: 'failed', code: 'ETIMEDOUT' }))
    socket.once('connect', () => finish({ status: 'ok' }))
    socket.once('error', (error) => finish({ status: 'failed', code: errorCode(error) }))
  })
}

function testTls(address, port, servername) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: address, port, ...(servername ? { servername } : {}), rejectUnauthorized: true })
    const finish = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(TIMEOUT_MS, () => finish({ status: 'failed', code: 'ETIMEDOUT' }))
    socket.once('secureConnect', () => finish({
      status: 'ok',
      authorized: socket.authorized,
      protocol: socket.getProtocol(),
    }))
    socket.once('error', (error) => finish({ status: 'failed', code: errorCode(error) }))
  })
}

async function main() {
  if (!uri) {
    console.log(JSON.stringify({ status: 'configuration_missing', variable: 'MONGODB_URI' }))
    process.exitCode = 2
    return
  }

  let parsed
  try {
    parsed = new URL(uri.replace(/^mongodb\+srv:/i, 'mongodb:'))
  } catch {
    console.log(JSON.stringify({ status: 'configuration_invalid', variable: 'MONGODB_URI' }))
    process.exitCode = 2
    return
  }

  const isSrv = /^mongodb\+srv:/i.test(uri)
  let targets
  try {
    if (isSrv) {
      const records = await resolveDns('resolveSrv', `_mongodb._tcp.${parsed.hostname}`)
      targets = records.slice(0, 5).map(({ name, port }) => ({ host: name.replace(/\.$/, ''), port }))
      console.log(JSON.stringify({ stage: 'dns_srv', status: 'ok', records: records.length, tested: targets.length }))
      try {
        const txtRecords = await resolveDns('resolveTxt', parsed.hostname)
        console.log(JSON.stringify({ stage: 'dns_txt', status: 'ok', records: txtRecords.length }))
      } catch (error) {
        const code = errorCode(error)
        console.log(JSON.stringify({ stage: 'dns_txt', status: code === 'ENODATA' ? 'not_present' : 'failed', ...(code === 'ENODATA' ? {} : { code }) }))
      }
    } else {
      const hostList = parsed.hostname.split(',')
      if (hostList.length !== 1) {
        console.log(JSON.stringify({ status: 'unsupported_uri_topology', detail: 'Use a single-host URI for this diagnostic.' }))
        process.exitCode = 2
        return
      }
      targets = [{ host: parsed.hostname, port: Number(parsed.port || 27017) }]
    }
  } catch (error) {
    console.log(JSON.stringify({ stage: isSrv ? 'dns_srv' : 'dns_lookup', status: 'failed', code: errorCode(error) }))
    process.exitCode = 1
    return
  }

  if (!targets.length) {
    console.log(JSON.stringify({ stage: 'srv_targets', status: 'failed', detail: 'No targets returned' }))
    process.exitCode = 1
    return
  }

  const results = []
  for (const [index, { host, port }] of targets.entries()) {
    let addresses
    try {
      addresses = await resolveAddresses(host)
      console.log(JSON.stringify({ stage: 'dns_target', target: index + 1, status: 'ok', addresses: addresses.length }))
    } catch (error) {
      const code = errorCode(error)
      console.log(JSON.stringify({ stage: 'dns_target', target: index + 1, status: 'failed', code }))
      results.push({ target: index + 1, port, tcp: { status: 'not_run', code: 'DNS_FAILED' }, tls: { status: 'not_run', code: 'DNS_FAILED' } })
      continue
    }

    for (const [addressIndex, { address, family }] of addresses.slice(0, 4).entries()) {
      results.push({
        target: index + 1,
        address: addressIndex + 1,
        family,
        port,
        tcp: await testTcp(address, port),
        tls: await testTls(address, port, net.isIP(host) ? undefined : host),
      })
    }
  }
  for (const result of results) console.log(JSON.stringify(result))
  console.log(JSON.stringify({ stage: 'runtime', node: process.version, openssl: process.versions.openssl }))
  if (results.some(({ tcp, tls: tlsResult }) => tcp.status !== 'ok' || tlsResult.status !== 'ok' || tlsResult.authorized !== true)) process.exitCode = 1
}

await main()
