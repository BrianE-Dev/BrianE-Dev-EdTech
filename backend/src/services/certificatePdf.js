const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595

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

function pdfObjects(stream) {
  const streamBytes = Buffer.from(stream, 'latin1')
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    '<< /Title (BrianE-Dev Certificate of Completion) /Creator (BrianE-Dev) >>',
  ]
}

function assemblePdf(stream) {
  const objects = pdfObjects(stream)
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

export function createCertificatePdf(certificate, verificationUrl) {
  const navy = '0.047 0.102 0.169'
  const teal = '0.10 0.60 0.60'
  const gold = '0.80 0.62 0.32'
  const ink = '0.10 0.17 0.24'
  const muted = '0.34 0.42 0.49'
  const operations = [
    'q',
    `${navy} rg 0 382 ${PAGE_WIDTH} 213 re f`,
    `${teal} RG 2 w 26 26 ${PAGE_WIDTH - 52} ${PAGE_HEIGHT - 52} re S`,
    `${gold} RG 0.7 w 34 34 ${PAGE_WIDTH - 68} ${PAGE_HEIGHT - 68} re S`,
    `${teal} RG 1 w 58 58 m 145 58 l S 697 58 m 784 58 l S`,
    textCommand('BRIANE-DEV', PAGE_WIDTH / 2, 527, 15, 'F2', '0.40 0.82 0.80', 'center'),
    textCommand('CERTIFICATE OF COMPLETION', PAGE_WIDTH / 2, 478, 26, 'F2', '1 1 1', 'center'),
    textCommand('This certificate is presented to', PAGE_WIDTH / 2, 348, 13, 'F3', muted, 'center'),
  ]
  const nameLines = wrapName(certificate.recipientName || 'Learner')
  const nameSize = nameLines.length > 1 ? 25 : nameLines[0].length > 27 ? 27 : 32
  nameLines.forEach((line, index) => operations.push(textCommand(line, PAGE_WIDTH / 2, 306 - index * 37, nameSize, 'F2', ink, 'center')))
  const courseTop = nameLines.length > 1 ? 228 : 264
  const courseLines = wrapName(certificate.courseTitle || 'AI-Powered Developer Productivity for Software Engineers', 38)
  operations.push(textCommand('for completing the course', PAGE_WIDTH / 2, courseTop, 12, 'F3', muted, 'center'))
  courseLines.forEach((line, index) => operations.push(textCommand(line, PAGE_WIDTH / 2, courseTop - 32 - index * 23, 18, 'F2', navy, 'center')))
  const ruleY = courseTop - 40 - courseLines.length * 23
  operations.push(`${gold} RG 1.2 w 286 ${ruleY} m 556 ${ruleY} l S`)
  const issueDate = new Date(certificate.issueDate || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  operations.push(
    textCommand('Issued by BrianE-Dev', PAGE_WIDTH / 2, 112, 11, 'F2', ink, 'center'),
    textCommand(`Issue date: ${issueDate}`, PAGE_WIDTH / 2, 92, 9, 'F1', muted, 'center'),
    textCommand(`Certificate ID: ${certificate.certificateId}`, PAGE_WIDTH / 2, 72, 9, 'F2', ink, 'center'),
    textCommand(`Verify: ${verificationUrl}`, PAGE_WIDTH / 2, 48, 8.2, 'F1', muted, 'center'),
    'Q',
  )
  return assemblePdf(operations.join('\n'))
}
