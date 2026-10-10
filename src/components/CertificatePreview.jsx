export default function CertificatePreview({ template, recipientName, courseTitle, issueDate = new Date(), certificateId = 'PREVIEW-CERTIFICATE' }) {
  const date = new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const registry = `BDEV-REG-${certificateId}`
  return <article className="certificate-artwork" aria-label="Certificate preview">
    <div className="certificate-registry"><span>GLOBAL REGISTRY REF: {registry} // REF NUMBER: {certificateId}</span><span>CERTIFICATE NO: {certificateId} // ARCHIVAL RECORD</span></div>
    <img className="certificate-watermark" src="/light-logo.png" alt="" aria-hidden="true"/>
    <header className="certificate-brand-lockup"><img className="certificate-brand-logo" src="/light-logo.png" alt="BrianE-Dev"/><div className="certificate-brand-line">{template.brandName}</div></header>
    <h2 className="certificate-heading">{template.heading}</h2>
    <span className="certificate-title-rule"/>
    <div className="certificate-artwork-body"><p>{template.introduction}</p><strong className="certificate-recipient">{recipientName || 'Learner Name'}</strong><span className="certificate-name-ornament"><i/><b>◇</b><i/><b>◇</b><i/></span><p className="certificate-course-lead">{template.courseLead}</p><strong className="certificate-course-title">{courseTitle || 'Course Title'}</strong></div>
    <footer><div className="certificate-issued certificate-issued-date"><span>Issued {date}</span></div><div className="certificate-signature">{template.signatureDataUrl && <img src={template.signatureDataUrl} alt="Signatory signature"/>}<strong>{template.signatoryName}</strong><span>{template.footer}</span></div><div className="certificate-issued"><span>IMMUTABLE VALIDATION</span><small>{certificateId}</small></div></footer>
    <div className="certificate-verification">VERIFICATION URL: /api/certificates/verify/{certificateId}</div>
  </article>
}
