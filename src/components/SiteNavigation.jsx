import { useState } from 'react'
import Brand from './Brand.jsx'
import Icon from './Icon.jsx'

const previewUrl = '/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer'

export default function SiteNavigation({ theme = 'dark', onThemeToggle, isAdmin = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return <header className="topbar">
    <a href="/" aria-label="BrianE-Dev homepage" onClick={closeMenu}><Brand /></a>
    <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
      <a href="/#top" onClick={closeMenu}>Home</a>
      <a href="/about" onClick={closeMenu}>About</a>
      <a href="/#curriculum" onClick={closeMenu}>Curriculum</a>
      <a href="/course/ai-powered-developer-productivity" onClick={closeMenu}>Course</a>
      <a href={previewUrl} onClick={closeMenu}>Free Preview</a>
      <a href="/#pricing" onClick={closeMenu}>Pricing</a>
      <a href="/services" onClick={closeMenu}>Services</a>
      <a href="/contact" onClick={closeMenu}>Contact</a>
      <a href="/privacy" onClick={closeMenu}>Privacy</a>
    </nav>
    <div className="nav-actions">
      {isAdmin && <a className="sign-in" href="/admin">Dashboard</a>}
      <a className="sign-in" href="/learn/login">Learner sign in</a>
      <button className="theme-toggle" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15}/><span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
      <a className="button button-small button-primary" href="/#pricing">Enroll Now <Icon name="arrow" size={14}/></a>
    </div>
    <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'}/></button>
  </header>
}
