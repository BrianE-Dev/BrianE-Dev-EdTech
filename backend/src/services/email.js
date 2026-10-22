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

export function safeMailConfigurationDiagnostic(env = process.env) {
  const port = Number(env.SMTP_PORT || 465)
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.toLowerCase() === 'true' : port === 465
  const user = env.SMTP_USER?.trim() || ''
  return {
    smtpHost: /^[A-Za-z0-9.-]{1,253}$/.test(env.SMTP_HOST || '') ? env.SMTP_HOST : (env.SMTP_HOST ? '[configured]' : ''),
    smtpPort: Number.isInteger(port) ? port : 'invalid',
    smtpSecure: secure,
    hasUser: Boolean(user),
    hasPassword: Boolean(env.SMTP_PASSWORD?.trim()),
    sender: senderAddress,
    userMatchesSender: user.toLowerCase() === senderAddress,
  }
}

function logMailConfigurationFailure(event, extra = {}) {
  console.error(JSON.stringify({ event, ...safeMailConfigurationDiagnostic(), ...extra }))
}

export function safeSmtpDiagnostic(error) {
  const code = /^[A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : ''
  const responseCode = Number.isInteger(Number(error?.responseCode)) ? Number(error.responseCode) : undefined
  const command = typeof error?.command === 'string' && /^[A-Z][A-Z0-9_ ]{0,39}$/i.test(error.command) ? error.command : undefined
  // SMTP responses can echo addresses or server details; keep diagnostics bounded and scrub address-like values.
  const message = String(error?.message || 'SMTP operation failed')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[address]')
    .replace(/(?:password|pass|auth(?:entication)?|token|credential)s?\s*[:=]?\s*[^\s,;]+/gi, '[redacted]')
    .replace(/\s+/g, ' ').trim().slice(0, 240)
  return { ...(code ? { errorCode: code } : {}), ...(command ? { command } : {}), ...(responseCode ? { responseCode } : {}), errorMessage: message }
}

export function smtpTransportOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 465)
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.toLowerCase() === 'true' : port === 465
  return {
    host: env.SMTP_HOST,
    port,
    secure,
    requireTLS: port === 587 && !secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  }
}

function getTransport() {
  const config = getMailConfiguration()
  if (!config.configured) return null
  const options = smtpTransportOptions()
  const { port, secure } = options
  const key = [process.env.SMTP_HOST, port, secure, process.env.SMTP_USER, process.env.SMTP_PASSWORD].join('|')
  if (!cachedTransport || cachedTransportKey !== key) {
    cachedTransport = nodemailer.createTransport(options)
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
  const logoUrl = new URL('/branding/briane-dev-logo-light.png', base).href
  const brandedHeader = `<div style="margin:0 0 22px;padding:0 0 16px;text-align:center;border-bottom:3px solid #7c3aed"><a href="${escapeHtml(base)}" style="display:inline-block;text-decoration:none"><img src="${escapeHtml(logoUrl)}" width="110" alt="BrianE-Dev" style="display:block;width:110px;height:auto;border:0"></a></div>`
  const brandedHtml = html.replace('<p style="margin:0 0 22px;color:#087f9a;font-weight:700">BRIANE-DEV</p>', brandedHeader)
  return { subject: `BrianE-Dev: ${title}`, html: brandedHtml, text }
}

export async function sendEmail({ to, subject, html, text, messageId }) {
  const transport = getTransport()
  if (!transport) {
    const missing = getMailConfiguration().missing
    logMailConfigurationFailure('transactional_email_not_configured', { missing })
    return { state: 'not_configured', accepted: false, missing }
  }
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
    if (!accepted) logMailConfigurationFailure('transactional_email_failed', { errorCode: 'SMTP_RECIPIENT_REJECTED' })
    return { state: accepted ? 'accepted' : 'failed', accepted, messageId: result.messageId || '', errorCode: accepted ? '' : 'SMTP_RECIPIENT_REJECTED' }
  } catch (error) {
    const diagnostic = safeSmtpDiagnostic(error)
    const errorCode = diagnostic.errorCode || 'SMTP_SEND_FAILED'
    logMailConfigurationFailure('transactional_email_failed', { ...diagnostic })
    return { state: 'failed', accepted: false, errorCode }
  }
}

export async function sendSecurityEmail(user, purpose, token) {
  try {
    const content = createSecurityEmailContent(purpose, token, user.name)
    return await sendEmail({ to: user.email, ...content })
  } catch (error) {
    logMailConfigurationFailure('transactional_email_configuration_failed', {
      errorCode: error instanceof TypeError ? 'EMAIL_CONFIGURATION_INVALID' : 'EMAIL_CONTENT_FAILED',
    })
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
