import Icon from './Icon.jsx'

export default function FeatureCard({ icon, tone, title, description, footer }) {
  return (
    <article className="feature-card">
      <span className={`feature-icon ${tone}`}><Icon name={icon}/></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="feature-foot">{footer}<i>↗</i></span>
    </article>
  )
}
