import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from './config/database.js'
import { Course, Pricing, User } from './models/index.js'
import { curriculum } from '../../src/data/curriculum.js'

await connectDatabase()
const sections = curriculum.sections.map((section) => ({
  title: section.title, description: section.description,
  chapters: section.chapters.map((chapter) => ({ title: chapter.title, content: '' })),
}))
await Course.findOneAndUpdate({ slug: 'ai-powered-developer-productivity' }, { $set: { title: curriculum.title, description: curriculum.description, sections, published: true, certificateEligible: true } }, { upsert: true, new: true })
await Pricing.bulkWrite([
  { updateOne: { filter: { region: 'INTL' }, update: { $setOnInsert: { region: 'INTL', countries: [], currency: 'USD', originalPrice: 15, currentPrice: 9, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true } }, upsert: true } },
  { updateOne: { filter: { region: 'NG' }, update: { $setOnInsert: { region: 'NG', countries: ['NG'], currency: 'NGN', originalPrice: 15000, currentPrice: 9000, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true } }, upsert: true } },
])
if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
  const bcrypt = await import('bcryptjs')
  await User.updateOne({ email: process.env.SEED_ADMIN_EMAIL.toLowerCase() }, { $setOnInsert: { name: process.env.SEED_ADMIN_NAME || 'Super Admin', email: process.env.SEED_ADMIN_EMAIL, passwordHash: await bcrypt.default.hash(process.env.SEED_ADMIN_PASSWORD, 12), role: 'super_admin' } }, { upsert: true })
}
console.log('Course and initial pricing seeded. Configure temporary SEED_ADMIN_* values to create an admin.')
await mongoose.disconnect()
