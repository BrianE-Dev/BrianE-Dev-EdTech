import mongoose from 'mongoose'

const { Schema, model } = mongoose
const timestamps = { timestamps: true }

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'super_admin'], default: 'user' },
  country: { type: String, uppercase: true, maxlength: 2 },
  currency: { type: String, enum: ['NGN', 'USD'], default: 'USD' },
}, timestamps)

const courseSchema = new Schema({
  title: { type: String, required: true }, slug: { type: String, required: true, unique: true },
  description: String, sections: [{ title: String, description: String, chapters: [{ title: String, content: String }] }],
  published: { type: Boolean, default: false }, certificateEligible: { type: Boolean, default: true },
}, timestamps)

const pricingSchema = new Schema({
  region: { type: String, required: true, unique: true, enum: ['NG', 'INTL'] }, countries: [String],
  currency: { type: String, required: true, enum: ['NGN', 'USD'] }, originalPrice: { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, required: true, min: 0 }, discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountValue: { type: Number, default: 0, min: 0 }, discountEnabled: { type: Boolean, default: false }, active: { type: Boolean, default: true },
  startDate: Date, endDate: Date, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, timestamps)

const paymentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  application: { type: String, enum: ['brianedev', 'devportix'], default: 'brianedev', required: true },
  productType: { type: String, enum: ['course'], default: 'course', required: true }, productId: { type: String, required: true }, productName: { type: String, required: true },
  reference: { type: String, required: true, unique: true }, paystackReference: { type: String, unique: true, sparse: true }, transactionId: String, paystackTransactionId: String, amount: { type: Number, required: true },
  currency: { type: String, required: true, enum: ['NGN', 'USD'] }, originalPrice: Number, originalAmount: Number, discount: Number, discountAmount: Number,
  discountType: { type: String, enum: ['percentage', 'fixed'] }, discountValue: Number, pricingId: { type: Schema.Types.ObjectId, ref: 'Pricing' },
  region: String, status: { type: String, enum: ['pending', 'processing', 'paid', 'successful', 'failed', 'cancelled', 'abandoned', 'refunded'], default: 'pending' },
  provider: { type: String, default: 'paystack' }, paidAt: Date, metadata: Schema.Types.Mixed,
}, timestamps)

const progressSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  completedChapters: [{ type: String }], completionPercentage: { type: Number, default: 0, min: 0, max: 100 }, completedAt: Date, lastAccessedAt: Date,
}, timestamps)
progressSchema.index({ user: 1, course: 1 }, { unique: true })

const certificateSchema = new Schema({
  certificateId: { type: String, unique: true, required: true }, user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true }, recipientName: String, courseTitle: String,
  issueDate: Date, completionDate: Date, verificationStatus: { type: String, enum: ['valid', 'revoked'], default: 'valid' },
}, timestamps)

const auditSchema = new Schema({ admin: { type: Schema.Types.ObjectId, ref: 'User', required: true }, action: String, resource: String, previousValue: Schema.Types.Mixed, newValue: Schema.Types.Mixed }, timestamps)

export const User = model('User', userSchema)
export const Course = model('Course', courseSchema)
export const Pricing = model('Pricing', pricingSchema)
export const Payment = model('Payment', paymentSchema)
export const Progress = model('Progress', progressSchema)
export const Certificate = model('Certificate', certificateSchema)
export const AuditLog = model('AuditLog', auditSchema)
