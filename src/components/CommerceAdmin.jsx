import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

const labels = { NG: 'Nigeria', INTL: 'International' }

export default function CommerceAdmin({ onClose, standalone = false }) {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('pricing')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    api(`/admin/${tab}`).then((result) => setItems(Array.isArray(result) ? result : [])).catch((error) => setNotice(error.message)).finally(() => setBusy(false))
  }, [tab])

  async function save(region, form) {
    setNotice('')
    try {
      const saved = await api(`/admin/pricing/${region}`, { method: 'PUT', body: JSON.stringify({
        region, currency: form.get('currency'), originalPrice: Number(form.get('originalPrice')), discountType: form.get('discountType'), discountValue: Number(form.get('discountValue')),
        discountEnabled: form.get('discountEnabled') === 'on', active: form.get('active') === 'on',
        startDate: form.get('startDate') ? new Date(form.get('startDate')).toISOString() : null,
        endDate: form.get('endDate') ? new Date(`${form.get('endDate')}T23:59:59`).toISOString() : null,
      }) })
      setItems((current) => current.map((item) => item.region === region ? saved : item))
      setNotice(`${labels[region]} pricing saved.`)
    } catch (error) { setNotice(error.message) }
  }

  async function switchTab(next) {
    setBusy(true); setItems([]); setNotice(''); setTab(next)
  }

  return <div className={standalone ? 'commerce-page' : 'commerce-overlay'} role={standalone ? undefined : 'presentation'} onMouseDown={(event) => { if (!standalone && event.target === event.currentTarget) onClose?.() }}>
    <section className={`commerce-panel ${standalone ? 'commerce-panel-standalone' : ''}`} role={standalone ? 'region' : 'dialog'} aria-modal={standalone ? undefined : true} aria-labelledby="commerce-title">
      <header><div><span className="eyebrow">SUPER ADMIN / COMMERCE</span><h2 id="commerce-title">Commerce management</h2></div>{!standalone && <button className="button button-secondary" onClick={onClose}>Close</button>}</header>
      <nav aria-label="Commerce sections">{['pricing', 'transactions', 'purchases', 'certificates'].map((name) => <button key={name} className={tab === name ? 'is-active' : ''} onClick={() => switchTab(name)}>{name}</button>)}</nav>
      {notice && <p className="commerce-notice" role="status">{notice}</p>}
      {busy ? <p>Loading…</p> : tab === 'pricing' ? <div className="commerce-pricing-grid">{items.map((item) => <form key={item.region} onSubmit={(event) => { event.preventDefault(); save(item.region, new FormData(event.currentTarget)) }}>
        <span className="eyebrow">{labels[item.region]}</span><h3>Regional price</h3>
        <label>Region<select name="region" value={item.region} disabled><option value={item.region}>{labels[item.region]}</option></select></label>
        <label>Currency<select name="currency" defaultValue={item.currency}><option value="NGN">NGN</option><option value="USD">USD</option></select></label>
        <label>Original price ({item.currency})<input name="originalPrice" type="number" step="0.01" min="0.01" defaultValue={item.originalPrice} required /></label>
        <label>Discount type<select name="discountType" defaultValue={item.discountType}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
        <label>Discount value<input name="discountValue" type="number" step="0.01" min="0" defaultValue={item.discountValue} required /></label>
        <label>Promotion starts<input name="startDate" type="date" defaultValue={item.startDate?.slice(0, 10) || ''} /></label>
        <label>Promotion ends<input name="endDate" type="date" defaultValue={item.endDate?.slice(0, 10) || ''} /></label>
        <div className="commerce-checks"><label><input name="discountEnabled" type="checkbox" defaultChecked={item.discountEnabled} /> Discount enabled</label><label><input name="active" type="checkbox" defaultChecked={item.active} /> Region active</label></div>
        <p>Live preview: <strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(item.currentPrice)}</strong></p>
        <button className="button button-primary" type="submit">Save pricing</button>
      </form>)}</div> : <div className="commerce-table-wrap"><table><thead><tr>{tab === 'certificates' ? <><th>Certificate</th><th>Learner</th><th>Course</th><th>Issued</th><th>Status</th></> : <><th>Customer</th><th>Course</th><th>Amount</th><th>Provider</th><th>Region</th><th>Reference</th><th>Status</th><th>Date</th></>}</tr></thead><tbody>{items.map((item) => <tr key={item._id}>{tab === 'certificates' ? <><td>{item.certificateId}</td><td>{item.user?.name}</td><td>{item.course?.title || item.courseTitle}</td><td>{item.issueDate && new Date(item.issueDate).toLocaleDateString()}</td><td>{item.verificationStatus}</td></> : <><td>{item.user?.name || item.user?.email}</td><td>{item.course?.title}</td><td>{item.amount} {item.currency}</td><td>{item.provider === 'paystack' ? 'Paystack' : item.provider}</td><td>{item.region}</td><td>{item.reference}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></>}</tr>)}</tbody></table>{!items.length && <p>No records yet.</p>}</div>}
    </section>
  </div>
}
