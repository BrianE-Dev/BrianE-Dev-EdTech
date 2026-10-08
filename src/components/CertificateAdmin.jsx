import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import CertificatePreview from './CertificatePreview.jsx'

const defaults = { brandName: '', heading: '', introduction: '', courseLead: '', signatoryName: '', signatureDataUrl: '', footer: '' }

export default function CertificateAdmin({ courses }) {
  const [template, setTemplate] = useState(defaults)
  const [sampleName, setSampleName] = useState('Alex Morgan')
  const [courseId, setCourseId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sampleUrl, setSampleUrl] = useState('')
  useEffect(() => { api('/admin/certificate-template').then(setTemplate).catch((e) => setError(e.message)) }, [])
  const effectiveCourseId = courseId || courses[0]?.id || ''
  const selectedCourse = courses.find((course) => course.id === effectiveCourseId)
  function update(event) { setTemplate((current) => ({ ...current, [event.target.name]: event.target.value })); setMessage(''); setError('') }
  async function uploadSignature(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setMessage('')
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setError('Choose a PNG or JPEG signature image.'); return }
    if (file.size > 3_000_000) { setError('Signature image must be 3 MB or smaller.'); return }
    try {
      const image = new Image()
      image.src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 200
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, 600, 200)
      const scale = Math.min(560 / image.width, 160 / image.height)
      context.drawImage(image, (600 - image.width * scale) / 2, (200 - image.height * scale) / 2, image.width * scale, image.height * scale)
      setTemplate((current) => ({ ...current, signatureDataUrl: canvas.toDataURL('image/jpeg', 0.9) }))
    } catch { setError('The signature image could not be read.') }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { setTemplate(await api('/admin/certificate-template', { method: 'PUT', body: JSON.stringify(template) })); setMessage('Global certificate saved.') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function generateSample() {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(`${apiUrl()}/admin/certificates/sample`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientName: sampleName, courseId: effectiveCourseId }) })
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || 'Sample certificate could not be generated.') }
      if (sampleUrl) URL.revokeObjectURL(sampleUrl)
      const url = URL.createObjectURL(await response.blob()); setSampleUrl(url)
      setMessage('Sample certificate generated. Open or download the PDF below.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section className="admin-certificate-section" aria-labelledby="certificate-admin-title">
    <div className="admin-learners-heading"><div><span className="eyebrow">CERTIFICATES / GLOBAL DESIGN</span><h2 id="certificate-admin-title">Certificate content and signatory</h2></div><p>Name and course title are filled from the learner and course records.</p></div>
    <div className="admin-certificate-layout"><form className="admin-certificate-form" onSubmit={save}>
      <label>Brand name<input name="brandName" maxLength="80" value={template.brandName} onChange={update} required/></label>
      <label>Certificate heading<input name="heading" maxLength="100" value={template.heading} onChange={update} required/></label>
      <label>Presentation line<input name="introduction" maxLength="180" value={template.introduction} onChange={update} required/></label>
      <label>Course completion line<input name="courseLead" maxLength="120" value={template.courseLead} onChange={update} required/></label>
      <label>Sole signatory name<input name="signatoryName" maxLength="120" value={template.signatoryName} onChange={update} required/></label>
      <label>Footer text<input name="footer" maxLength="180" value={template.footer} onChange={update}/></label>
      <label>Upload signature (PNG or JPEG)<input type="file" accept="image/png,image/jpeg" onChange={uploadSignature}/></label>
      {template.signatureDataUrl && <div className="admin-signature-actions"><img src={template.signatureDataUrl} alt="Uploaded signatory signature"/><button className="button button-secondary" type="button" onClick={() => setTemplate((current) => ({ ...current, signatureDataUrl: '' }))}>Remove signature</button></div>}
      {error && <p className="admin-form-error" role="alert">{error}</p>}{message && <p className="admin-audio-notice" role="status">{message}</p>}{sampleUrl && <a className="button button-secondary" href={sampleUrl} target="_blank" rel="noreferrer">Open sample certificate PDF</a>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save global certificate'}</button>
    </form><div className="admin-certificate-preview"><span className="eyebrow">LIVE PREVIEW</span><CertificatePreview template={template} recipientName={sampleName} courseTitle={selectedCourse?.title}/><div className="admin-sample-controls"><label>Sample learner name<input value={sampleName} onChange={(e) => setSampleName(e.target.value)} maxLength="120"/></label><label>Sample course<select value={effectiveCourseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><button type="button" className="button button-secondary" disabled={busy || !effectiveCourseId || !sampleName.trim()} onClick={generateSample}>Generate sample PDF</button></div></div></div>
  </section>
}

function apiUrl() { return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api') }
