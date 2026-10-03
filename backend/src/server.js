import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/database.js'

const port = Number(process.env.PORT || 4000)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
await connectDatabase()
app.listen(port, () => console.log(`BrianE-Dev API listening on ${port}`))
