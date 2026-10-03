import Icon from './Icon.jsx'

export default function PricingCard({ item, selected, onSelect, busy = false, error = '' }) {
  return (
    <article className={`price-card ${selected ? 'selected' : ''}`}>
      <div className="price-topline"><span>{item.label}</span>{item.popular && <span className="popular-tag">MOST POPULAR</span>}</div>
      <h3>{item.name}</h3><p className="price-desc">{item.desc}</p>
      <div className="price-amount">{item.originalPrice && item.originalPrice !== item.currentPrice && <del>{item.originalPrice}</del>}<strong>{item.price}</strong><span>{item.period}</span></div>
      {item.discountLabel && <p className="pricing-discount">{item.discountLabel}</p>}
      {error && <p className="pricing-error" role="alert">{error}</p>}
      <ul>{item.features.map((feature) => <li key={feature}><Icon name="check" size={15}/>{feature}</li>)}</ul>
      <button type="button" className={`button ${selected ? 'button-primary' : 'button-secondary'} price-button`} onClick={onSelect} disabled={busy}>{busy ? 'Connecting…' : item.action} <Icon name="arrow" size={14}/></button>
    </article>
  )
}
