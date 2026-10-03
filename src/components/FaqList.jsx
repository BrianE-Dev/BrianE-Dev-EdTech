export default function FaqList({ items, openIndex, onToggle }) {
  return (
    <div className="faq-list">
      {items.map(([question, answer], index) => (
        <article className={`faq-item ${openIndex === index ? 'faq-open' : ''}`} key={question}>
          <button type="button" aria-expanded={openIndex === index} onClick={() => onToggle(openIndex === index ? -1 : index)}>
            <span><i>0{index + 1}</i>{question}</span>
            <b>{openIndex === index ? '−' : '+'}</b>
          </button>
          {openIndex === index && <p>{answer}</p>}
        </article>
      ))}
    </div>
  )
}
