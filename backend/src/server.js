import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { connectDatabase } from './config/database.js'
import { getPaystackConfig } from './config/paystack.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const portValue = process.env.PORT
const port = portValue === undefined ? 4000 : Number(portValue)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535')
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
getPaystackConfig()
await connectDatabase()
const { default: app } = await import('./app.js')
const { resumeCourseAudioBatches } = await import('./services/ttsGeneration.js')
await resumeCourseAudioBatches()
app.listen(port, '0.0.0.0', () => console.log(`BrianE-Dev API listening on ${port}`))
