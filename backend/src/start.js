import { startServer } from './server.js'

startServer().catch((error) => {
  console.error(`BrianE-Dev startup failed (${error.name || 'Error'}): ${String(error.message || error).replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]')}`)
  process.exit(1)
})
