const fullCourseBenefits = [
  'All 43 authored lessons, examples, and workflows',
  'Lesson assessments and required activities',
  'Saved progress tracked against the stable 43 chapter curriculum',
  'Certificate eligibility after all 43 chapters and required activities are complete',
  'Downloadable course ebook',
]

export default function PurchaseGate({ preview = false, chapterTitle = 'This chapter' }) {
  return <section className={`purchase-gate${preview ? ' purchase-gate-preview' : ''}`} aria-labelledby="purchase-gate-title">
    <span className="eyebrow">{preview ? 'YOUR FREE CHAPTER' : 'FULL COURSE ACCESS'}</span>
    <h2 id="purchase-gate-title">{preview ? 'Want to continue learning?' : `Unlock ${chapterTitle}`}</h2>
    <p>{preview ? 'Create your learner account after completing payment to open the full 43-chapter learning space and save your progress.' : 'A confirmed purchase is required to open the complete lesson, assessments, and required activities.'}</p>
    {!preview && <ul>{fullCourseBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>}
    <div className="purchase-gate-actions">
      <a className="button button-primary" href={preview ? '/learn/register' : '/#pricing'}>{preview ? 'Sign up after payment' : 'Unlock the Full Course'}</a>
      {!preview && <a className="learner-text-link" href="/#curriculum">View the curriculum</a>}
    </div>
  </section>
}
