import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { connectDatabase } from './config/database.js'
import { getPaystackConfig } from './config/paystack.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const port = Number(process.env.PORT || 4000)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
getPaystackConfig()
await connectDatabase()
const { default: app } = await import('./app.js')
app.listen(port, '0.0.0.0', () => console.log(`BrianE-Dev API listening on ${port}`))
