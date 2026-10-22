import assert from 'node:assert/strict'
import test from 'node:test'
import { createSecurityEmailContent, safeSmtpDiagnostic, smtpTransportOptions } from '../backend/src/services/email.js'

test('SMTP options preserve implicit TLS on 465 and STARTTLS on 587', () => {
  const base = { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'mailer@example.test', SMTP_PASSWORD: 'do-not-print' }
  const ssl = smtpTransportOptions({ ...base, SMTP_PORT: '465', SMTP_SECURE: 'true' })
  assert.equal(ssl.port, 465)
  assert.equal(ssl.secure, true)
  assert.equal(ssl.requireTLS, false)
  assert.equal(ssl.auth.pass, 'do-not-print')

  const startTls = smtpTransportOptions({ ...base, SMTP_PORT: '587', SMTP_SECURE: 'false' })
  assert.equal(startTls.port, 587)
  assert.equal(startTls.secure, false)
  assert.equal(startTls.requireTLS, true)
})

test('SMTP diagnostics preserve safe codes while scrubbing addresses and credentials', () => {
  const diagnostic = safeSmtpDiagnostic({
    code: 'EAUTH', command: 'AUTH LOGIN', responseCode: 535,
    message: 'Authentication failed for mailer@example.test password=hunter2 token=abc123',
  })
  assert.equal(diagnostic.errorCode, 'EAUTH')
  assert.equal(diagnostic.command, 'AUTH LOGIN')
  assert.equal(diagnostic.responseCode, 535)
  assert.doesNotMatch(JSON.stringify(diagnostic), /mailer@example\.test|hunter2|abc123/)
})

test('verification email uses production origin and matching route/token parameter', () => {
  const original = process.env.PUBLIC_APP_URL
  process.env.PUBLIC_APP_URL = 'https://briane-dev.online/some/path'
  try {
    const content = createSecurityEmailContent('verify', 'opaque-test-token')
    assert.match(content.text, /https:\/\/briane-dev\.online\/learn\/verify-email\?token=opaque-test-token/)
  } finally {
    if (original === undefined) delete process.env.PUBLIC_APP_URL
    else process.env.PUBLIC_APP_URL = original
  }
})
