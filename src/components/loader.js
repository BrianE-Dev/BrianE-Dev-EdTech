import './loader.css'

/** Brand loader that automatically follows the app's light/dark theme. */
export default function Loader({ label = 'Loading…', className = '' }) {
  return <div className={`brand-loader ${className}`.trim()} role="status" aria-label={label}>
    <span className="brand-loader-mark" aria-hidden="true">
      <img className="brand-loader-logo brand-loader-logo-light" src="/branding/briane-dev-logo-light.svg" alt=""/>
      <img className="brand-loader-logo brand-loader-logo-dark" src="/branding/briane-dev-logo-dark.svg" alt=""/>
    </span>
    <span className="brand-loader-label">{label}</span>
  </div>
}
