const fullCourseBenefits = [
  'Complete Chapter 1 and any other lessons once they are published',
  'Assessments and required exercises attached to published lessons',
  'Saved progress tracked against the stable 43 chapter curriculum',
  'Certificate eligibility after all 43 chapters and required activities are complete',
  'Course ebook download after its PDF is published',
]

export default function PurchaseGate({ preview = false, chapterTitle = 'This chapter' }) {
  return <section className={`purchase-gate${preview ? ' purchase-gate-preview' : ''}`} aria-labelledby="purchase-gate-title">
    <span className="eyebrow">{preview ? 'FREE CHAPTER 1 PREVIEW' : 'FULL COURSE ACCESS'}</span>
    <h2 id="purchase-gate-title">{preview ? 'That’s the end of the free preview' : `Unlock ${chapterTitle}`}</h2>
    <p>{preview ? 'A confirmed purchase unlocks the rest of Chapter 1. The other 42 chapter lessons and the course ebook have not been published yet.' : 'A confirmed purchase is required for full lesson access. Chapter 1 is currently the only authored lesson; the other 42 chapter lessons and the ebook PDF are not yet available.'}</p>
    <ul>{fullCourseBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
    <div className="purchase-gate-actions">
      <a className="button button-primary" href="/#pricing">Unlock the Full Course</a>
      <a className="learner-text-link" href="/#curriculum">View the curriculum</a>
    </div>
  </section>
}
