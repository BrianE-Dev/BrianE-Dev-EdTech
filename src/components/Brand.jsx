export default function Brand({ compact = false }) {
  return (
    <a className={`brand${compact ? ' brand-compact' : ''}`} href="#top" aria-label="BrianE-Dev home">
      <img className="brand-logo brand-logo-light" src={compact ? '/branding/briane-dev-mark-light.svg' : '/branding/briane-dev-logo-light.svg'} alt="" aria-hidden="true" />
      <img className="brand-logo brand-logo-dark" src={compact ? '/branding/briane-dev-mark-dark.svg' : '/branding/briane-dev-logo-dark.svg'} alt="" aria-hidden="true" />
    </a>
  )
}
