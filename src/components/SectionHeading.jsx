export default function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading-row">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
