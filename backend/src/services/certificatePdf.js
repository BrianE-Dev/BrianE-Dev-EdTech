import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const certificateLogo = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/light-logo.png'))

function pngImageData(png) {
  if (png.toString('ascii', 1, 4) !== 'PNG' || png[24] !== 8 || png[25] !== 2) throw new Error('Certificate logo must be an 8-bit RGB PNG')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const chunks = []
  let offset = 8
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
    if (type === 'IEND') break
  }
  if (!chunks.length) throw new Error('Certificate logo image data is missing')
  return { width, height, bytes: Buffer.concat(chunks) }
}

function safeText(value) {
  return String(value ?? '')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function winAnsiHex(value) {
  const bytes = []
  for (const character of safeText(value)) {
    const codePoint = character.codePointAt(0)
    bytes.push(codePoint <= 255 ? codePoint : 63)
  }
  return Buffer.from(bytes).toString('hex').toUpperCase()
}

function textCommand(value, x, y, size, font, color, align = 'left') {
  const content = safeText(value)
  const width = [...content].reduce((sum, character) => sum + (/[MW@%]/.test(character) ? 0.78 : /[ilI.,' ]/.test(character) ? 0.28 : 0.53), 0) * size
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${left.toFixed(2)} ${y.toFixed(2)} Tm <${winAnsiHex(content)}> Tj ET`
}

function wrapName(name, maxLength = 34) {
  const words = safeText(name).trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxLength && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['Learner']
}

function pdfObjects(stream, logo, signatureBytes = null) {
  const streamBytes = Buffer.from(stream, 'latin1')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> /ExtGState << /Watermark 11 0 R >> /XObject << /Logo 10 0 R${signatureBytes ? ' /Signature 12 0 R' : ''} >> >> /Contents 9 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Title (BrianE-Dev Certificate of Completion) /Creator (BrianE-Dev) >>',
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
  ]
  objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${logo.width} >> /Length ${logo.bytes.length} >>\nstream\n${logo.bytes.toString('latin1')}\nendstream`)
  objects.push('<< /Type /ExtGState /ca 0.06 /CA 0.06 >>')
  if (signatureBytes) objects.push(`<< /Type /XObject /Subtype /Image /Width 600 /Height 200 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${signatureBytes.length} >>\nstream\n${signatureBytes.toString('latin1')}\nendstream`)
  return objects
}

function assemblePdf(stream, logo, signatureBytes = null) {
  const objects = pdfObjects(stream, logo, signatureBytes)
  let document = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, 'latin1'))
    document += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(document, 'latin1')
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, '0')} 00000 n \n`
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(document, 'latin1')
}

export function createCertificatePdf(certificate, verificationUrl, template = {}) {
  const navy = '0.047 0.102 0.169'
  const teal = '0.10 0.60 0.60'
  const ink = '0.10 0.17 0.24'
  const muted = '0.34 0.42 0.49'
  const logo = pngImageData(certificateLogo)
  const operations = [
    'q',
    '0.84 0.88 0.91 RG 0.8 w 12 12 818 571 re S',
    `${teal} RG 0.8 w 20 20 802 555 re S`,
    'q /Watermark gs 330 0 0 330 256 132 cm /Logo Do Q',
    textCommand(`GLOBAL REGISTRY REF: BDEV-REG-${certificate.certificateId}`, 24, 576, 6.8, 'F1', muted),
    textCommand(`CERTIFICATE NO: ${certificate.certificateId} / ARCHIVAL RECORD`, PAGE_WIDTH - 24, 576, 6.8, 'F1', muted, 'right'),
    'q 70 0 0 70 34 490 cm /Logo Do Q',
    textCommand(template.brandName || 'BRIANE-DEV ACADEMY OF ADVANCED SOFTWARE ENGINEERING', 120, 531, 9, 'F1', navy),
    textCommand(template.heading || 'CERTIFICATE OF COMPLETION', PAGE_WIDTH / 2, 494, 27, 'F4', navy, 'center'),
    `${teal} RG 1.3 w 372 480 m 470 480 l S`,
    textCommand(template.introduction || 'This credential is officially conferred upon', PAGE_WIDTH / 2, 447, 13, 'F3', ink, 'center'),
  ]
  const nameLines = wrapName(certificate.recipientName || 'Learner')
  const nameSize = nameLines.length > 1 ? 27 : nameLines[0].length > 27 ? 29 : 35
  nameLines.forEach((line, index) => operations.push(textCommand(line, PAGE_WIDTH / 2, 403 - index * 32, nameSize, 'F4', ink, 'center')))
  const ornamentY = nameLines.length > 1 ? 334 : 365
  const courseTop = nameLines.length > 1 ? 307 : 339
  operations.push(`${teal} RG 0.8 w 319 ${ornamentY} m 362 ${ornamentY} l S 480 ${ornamentY} m 523 ${ornamentY} l S`, `${teal} rg 372 ${ornamentY} 7 7 re f`, `${teal} rg 463 ${ornamentY} 7 7 re f`)
  const courseLines = wrapName(certificate.courseTitle || 'AI-Powered Developer Productivity for Software Engineers', 38)
  const leadLines = wrapName(template.courseLead || 'for successfully mastering the curriculum, laboratory practicums, and comprehensive engineering benchmarks of', 94)
  leadLines.slice(0, 2).forEach((line, index) => operations.push(textCommand(line, PAGE_WIDTH / 2, courseTop - index * 15, 10, 'F1', ink, 'center')))
  courseLines.forEach((line, index) => operations.push(textCommand(line, PAGE_WIDTH / 2, courseTop - 39 - index * 22, 18, 'F4', navy, 'center')))
  const issueDate = new Date(certificate.issueDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const signature = template.signatureDataUrl?.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/)
  const signatureBytes = signature ? Buffer.from(signature[1], 'base64') : null
  if (signatureBytes?.length > 2_000_000) throw new Error('Certificate signature is too large')
  if (signatureBytes) operations.push('q 120 0 0 27 361 61 cm /Signature Do Q')
  operations.push(
    textCommand(template.signatoryName || 'BrianE-Dev', PAGE_WIDTH / 2, 57, 8, 'F2', ink, 'center'),
    textCommand(template.footer || '', PAGE_WIDTH / 2, 45, 7, 'F3', muted, 'center'),
    textCommand(`Issue date: ${issueDate}`, 34, 38, 7, 'F1', muted),
    textCommand(`Certificate ID: ${certificate.certificateId}`, PAGE_WIDTH - 34, 38, 7, 'F1', muted, 'right'),
    textCommand(`VERIFICATION URL: ${verificationUrl}`, PAGE_WIDTH / 2, 24, 5.8, 'F1', muted, 'center'),
    'Q',
  )
  return assemblePdf(operations.join('\n'), logo, signatureBytes)
}
