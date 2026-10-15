import { createServer } from 'node:http'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('./backend/.env', import.meta.url)) })

const portValue = process.env.PORT
const port = portValue === undefined ? 4000 : Number(portValue)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535')

let application

const server = createServer((req, res) => {
  if (application) return application(req, res)

  const pathname = req.url?.split('?')[0] || '/'
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/health') {
    res.statusCode = 200
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true }))
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/ready') {
    res.statusCode = 503
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: false, database: 'unavailable' }))
  }
  res.statusCode = 503
  res.end(JSON.stringify({ error: 'Application starting', code: 'APPLICATION_STARTING' }))
})

server.on('error', (error) => {
  console.error(`BrianE-Dev HTTP server failed (${error.code || error.name})`)
  process.exitCode = 1
})

server.listen(port, '0.0.0.0', () => {
  console.log(`BrianE-Dev HTTP listener bound on ${port}`)
  import('./backend/src/server.js')
    .then(async ({ loadApplication, startDatabaseMonitor }) => {
      application = await loadApplication()
      startDatabaseMonitor()
      console.log(`BrianE-Dev API ready to serve on ${port}; database connection is initializing`)
    })
    .catch((error) => {
      const message = String(error?.message || error || 'unknown error').replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]')
      console.error(`BrianE-Dev application startup failed (${error.name || 'Error'}): ${message}`)
      process.exit(1)
    })
})
