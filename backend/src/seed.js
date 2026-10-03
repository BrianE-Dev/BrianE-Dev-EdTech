import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { connectDatabase } from './config/database.js'
import { Course, Pricing, User } from './models/index.js'
import { curriculum, totalChapters } from '../../src/data/curriculum.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const courseSlug = 'ai-powered-developer-productivity'

if (curriculum.title !== 'AI-Powered Developer Productivity for Software Engineers' || curriculum.sections.length !== 8 || totalChapters !== 43) {
  throw new Error('Seed curriculum must retain the approved title, 8 sections, and 43 chapters')
}

try {
  await connectDatabase()

  const sections = curriculum.sections.map((section) => ({
    title: section.title,
    description: section.description,
    chapters: section.chapters.map((chapter) => ({ title: chapter.title, content: '' })),
  }))

  const course = await Course.findOneAndUpdate(
    { slug: courseSlug },
    { $set: { title: curriculum.title, description: curriculum.description, sections, published: true, certificateEligible: true } },
    { upsert: true, new: true, runValidators: true },
  )

  await Pricing.bulkWrite([
    { updateOne: { filter: { region: 'INTL' }, update: { $setOnInsert: { region: 'INTL', countries: [], currency: 'USD', originalPrice: 15, currentPrice: 9, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true } }, upsert: true } },
    { updateOne: { filter: { region: 'NG' }, update: { $setOnInsert: { region: 'NG', countries: ['NG'], currency: 'NGN', originalPrice: 15000, currentPrice: 9000, discountType: 'percentage', discountValue: 40, discountEnabled: true, active: true } }, upsert: true } },
  ])

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase()
    await User.updateOne(
      { email },
      { $setOnInsert: { name: process.env.SEED_ADMIN_NAME?.trim() || 'Super Admin', email, passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12), role: 'super_admin' } },
      { upsert: true, runValidators: true },
    )
  }

  const [pricingCount, adminCount] = await Promise.all([
    Pricing.countDocuments({ region: { $in: ['NG', 'INTL'] } }),
    process.env.SEED_ADMIN_EMAIL ? User.countDocuments({ email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(), role: 'super_admin' }) : Promise.resolve(0),
  ])
  console.info(`Seed complete: course has ${course.sections.length} sections and ${course.sections.reduce((count, section) => count + section.chapters.length, 0)} chapters; ${pricingCount} regional pricing records; ${adminCount ? 'configured Super Admin present' : 'no seeded Super Admin requested'}.`)
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
