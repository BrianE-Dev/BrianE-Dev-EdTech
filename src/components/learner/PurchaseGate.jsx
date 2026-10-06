const fullCourseBenefits = [
  'All 43 authored lessons, examples, and workflows',
  'Lesson assessments and required activities',
  'Saved progress tracked against the stable 43 chapter curriculum',
  'Certificate eligibility after all 43 chapters and required activities are complete',
  'Downloadable course ebook',
]

export default function PurchaseGate({ preview = false, chapterTitle = 'This chapter' }) {
  return <section className={`purchase-gate${preview ? ' purchase-gate-preview' : ''}`} aria-labelledby="purchase-gate-title">
    <span className="eyebrow">{preview ? 'FREE CHAPTER 1 PREVIEW' : 'FULL COURSE ACCESS'}</span>
    <h2 id="purchase-gate-title">{preview ? 'That’s the end of the free preview' : `Unlock ${chapterTitle}`}</h2>
    <p>{preview ? 'A confirmed purchase unlocks the rest of Chapter 1, all 42 other lessons, and the course ebook.' : 'A confirmed purchase is required to open the complete lesson, assessments, and required activities.'}</p>
    <ul>{fullCourseBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
    <div className="purchase-gate-actions">
      <a className="button button-primary" href="/#pricing">Unlock the Full Course</a>
      <a className="learner-text-link" href="/#curriculum">View the curriculum</a>
    </div>
  </section>
}
