import Icon from './Icon.jsx'

export default function Brand() {
  return (
    <a className="brand" href="#top" aria-label="BrianE-Dev home">
      <span className="brand-mark"><Icon name="code" size={17}/></span>
      <span>BrianE<span className="brand-accent">-Dev</span></span>
      <span className="brand-edition">EDTECH</span>
    </a>
  )
}
