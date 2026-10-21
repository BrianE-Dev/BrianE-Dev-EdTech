import nodemailer from 'nodemailer'

const senderAddress = 'info@briane-dev.online'
const senderName = 'BrianE-Dev'
let cachedTransport
let cachedTransportKey

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

export function getMailConfiguration() {
  const port = Number(process.env.SMTP_PORT || 465)
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter((key) => !process.env[key]?.trim())
  if (!Number.isInteger(port) || ![465, 587].includes(port)) missing.push('SMTP_PORT')
  if (process.env.SMTP_SECURE && !['true', 'false'].includes(process.env.SMTP_SECURE.toLowerCase())) missing.push('SMTP_SECURE')
  if ((port === 465 && process.env.SMTP_SECURE?.toLowerCase() === 'false') || (port === 587 && process.env.SMTP_SECURE?.toLowerCase() === 'true')) missing.push('SMTP_SECURE')
  try { publicAppUrl() } catch { missing.push('PUBLIC_APP_URL') }
  return { configured: missing.length === 0, missing }
}

function getTransport() {
  const config = getMailConfiguration()
  if (!config.configured) return null
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : port === 465
  const key = [process.env.SMTP_HOST, port, secure, process.env.SMTP_USER, process.env.SMTP_PASSWORD].join('|')
  if (!cachedTransport || cachedTransportKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      requireTLS: port === 587 && !secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
    cachedTransportKey = key
  }
  return cachedTransport
}

function publicAppUrl() {
  const value = (process.env.PUBLIC_APP_URL || 'https://briane-dev.online').trim()
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('PUBLIC_APP_URL must be an HTTP(S) origin')
  if ((process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') && url.protocol !== 'https:') throw new Error('PUBLIC_APP_URL must use HTTPS in production')
  return url.origin
}

export function createSecurityEmailContent(kind, token, name = '') {
  const base = publicAppUrl()
  const isVerification = kind === 'verify'
  const path = isVerification ? '/learn/verify-email' : '/learn/reset-password'
  const url = new URL(path, base)
  url.searchParams.set('token', token)
  const action = isVerification ? 'Verify email address' : 'Reset password'
  const title = isVerification ? 'Verify your email address' : 'Reset your password'
  const expiry = isVerification ? '24 hours' : '1 hour'
  const greeting = name ? `Hello ${name},` : 'Hello,'
  const text = `${greeting}\n\n${isVerification ? 'Please verify your email address to activate your BrianE-Dev learner account.' : 'We received a request to reset your BrianE-Dev password.'}\n\n${action}: ${url.href}\n\nThis link expires in ${expiry}. If you did not request this, you can ignore this message.`
  const html = `<div style="margin:0;background:#f3f6fb;padding:32px 12px;font-family:Arial,sans-serif;color:#17283e"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe4ee;border-radius:8px;padding:30px"><p style="margin:0 0 22px;color:#087f9a;font-weight:700">BRIANE-DEV</p><h1 style="font-size:24px;margin:0 0 16px">${title}</h1><p>${escapeHtml(greeting)}</p><p>${isVerification ? 'Verify your email address to activate your learner account.' : 'We received a request to reset your account password.'}</p><p style="margin:26px 0"><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:13px 18px;background:#06b6d4;color:#04151b;text-decoration:none;border-radius:4px;font-weight:700">${action}</a></p><p>This link expires in ${expiry}. If you did not make this request, you can ignore this email.</p><p style="font-size:12px;color:#64758a">${senderName} · <a href="${base}">briane-dev.online</a></p></div></div>`
  return { subject: `BrianE-Dev: ${title}`, html, text }
}

export async function sendEmail({ to, subject, html, text, messageId }) {
  const transport = getTransport()
  if (!transport) return { state: 'not_configured', accepted: false, missing: getMailConfiguration().missing }
  try {
    const result = await transport.sendMail({
      from: { name: senderName, address: senderAddress },
      to,
      replyTo: process.env.EMAIL_REPLY_TO || senderAddress,
      subject,
      html,
      text,
      ...(messageId ? { messageId } : {}),
    })
    const accepted = Array.isArray(result.accepted) && result.accepted.length > 0
    return { state: accepted ? 'accepted' : 'failed', accepted, messageId: result.messageId || '', errorCode: accepted ? '' : 'SMTP_RECIPIENT_REJECTED' }
  } catch (error) {
    const errorCode = /^[A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : 'SMTP_SEND_FAILED'
    console.error(JSON.stringify({ event: 'transactional_email_failed', errorCode }))
    return { state: 'failed', accepted: false, errorCode }
  }
}

export async function sendSecurityEmail(user, purpose, token) {
  try {
    const content = createSecurityEmailContent(purpose, token, user.name)
    return await sendEmail({ to: user.email, ...content })
  } catch {
    return { state: 'failed', accepted: false, errorCode: 'EMAIL_CONFIGURATION_INVALID' }
  }
}

export async function sendPasswordChangedNotification(user) {
  const text = `Hello ${user.name},\n\nThe password for your BrianE-Dev account was changed. If you did not make this change, contact ${senderAddress} immediately.\n\nBrianE-Dev`
  const html = `<div style="margin:0;background:#f3f6fb;padding:32px 12px;font-family:Arial,sans-serif;color:#17283e"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe4ee;border-radius:8px;padding:30px"><p style="color:#087f9a;font-weight:700">BRIANE-DEV</p><h1 style="font-size:22px">Password changed</h1><p>Hello ${escapeHtml(user.name)},</p><p>The password for your account was changed. If you did not make this change, contact <a href="mailto:${senderAddress}">${senderAddress}</a>.</p></div></div>`
  return sendEmail({ to: user.email, subject: 'BrianE-Dev password changed', text, html })
}

export async function sendEnquiryAcknowledgement(request) {
  const messageId = `<${request.reference.toLowerCase()}.ack@briane-dev.online>`
  const text = `Hello ${request.name},\n\nWe have received your ${request.kind === 'quote' ? 'project request' : 'enquiry'}. Your reference is ${request.reference}. Keep this reference if you contact us about your request.\n\nBrianE-Dev`
  const html = `<div style="margin:0;background:#f3f6fb;padding:32px 12px;font-family:Arial,sans-serif;color:#17283e"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe4ee;border-radius:8px;padding:30px"><p style="color:#087f9a;font-weight:700">BRIANE-DEV</p><h1 style="font-size:22px">We received your request</h1><p>Hello ${escapeHtml(request.name)},</p><p>We have received your ${request.kind === 'quote' ? 'project request' : 'enquiry'}.</p><p>Your reference: <strong>${escapeHtml(request.reference)}</strong></p><p>Keep this reference if you contact us about your request.</p></div></div>`
  return sendEmail({ to: request.email, subject: `BrianE-Dev request received · ${request.reference}`, text, html, messageId })
}

export async function sendEnquiryAdminNotification(request) {
  const to = process.env.EMAIL_ADMIN_RECIPIENT || senderAddress
  const text = `${request.kind === 'quote' ? 'Project quote request' : 'Contact enquiry'} ${request.reference}\nName: ${request.name}\nEmail: ${request.email}\nPhone: ${request.phone || 'Not supplied'}\nCompany: ${request.company || 'Not supplied'}\nSubject: ${request.subject}\nSource: ${request.sourcePage || 'Not recorded'}\n\n${request.message}`
  const html = `<div style="font-family:Arial,sans-serif;color:#17283e"><h1>${request.kind === 'quote' ? 'Project quote request' : 'Contact enquiry'}</h1><p>Reference: <strong>${escapeHtml(request.reference)}</strong></p><p>Name: ${escapeHtml(request.name)}<br>Email: ${escapeHtml(request.email)}<br>Phone: ${escapeHtml(request.phone || 'Not supplied')}<br>Company: ${escapeHtml(request.company || 'Not supplied')}<br>Source: ${escapeHtml(request.sourcePage || 'Not recorded')}</p><p>${escapeHtml(request.subject)}</p><p>${escapeHtml(request.message).replaceAll('\n', '<br>')}</p></div>`
  return sendEmail({ to, subject: `New ${request.kind === 'quote' ? 'quote request' : 'enquiry'} · ${request.reference}`, text, html, messageId: `<${request.reference.toLowerCase()}.admin@briane-dev.online>` })
}
