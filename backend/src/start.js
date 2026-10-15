import { startServer } from './server.js'
import { runtimeLogPrefix } from './config/runtimeIdentity.js'

startServer().catch((error) => {
  console.error(`${runtimeLogPrefix()} BrianE-Dev startup failed (${error.name || 'Error'}): ${String(error.message || error).replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted MongoDB URI]')}`)
  process.exit(1)
})
