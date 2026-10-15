
import('./backend/src/server.js').catch((error) => {
  console.error('BrianE-Dev startup failed:', error)
  process.exit(1)
})
