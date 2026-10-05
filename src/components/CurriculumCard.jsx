import { useId, useState } from 'react'
import Icon from './Icon.jsx'

export default function CurriculumCard({ section }) {
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const chaptersId = useId()

  return (
    <article className={`path-card ${section.color}`}>
      <div className="path-meta"><span>SECTION {String(section.number).padStart(2, '0')}</span><span>{section.chapters.length} CHAPTERS</span></div>
      <span className="path-level">{section.category}</span>
      <h3>{section.title}</h3>
      <p>{section.description}</p>
      <div className="path-footer">
        <span>{section.chapters.length} CHAPTERS</span>
        <button type="button" aria-expanded={chaptersOpen} aria-controls={chaptersId} onClick={() => setChaptersOpen(!chaptersOpen)}>
          {chaptersOpen ? 'HIDE CHAPTERS' : 'VIEW CHAPTERS'} <Icon name={chaptersOpen ? 'close' : 'arrow'} size={13}/>
        </button>
      </div>
      <ol className="chapter-list" id={chaptersId} hidden={!chaptersOpen}>{section.chapters.map((chapter) => <li key={chapter.id}><span>{String(chapter.number).padStart(2, '0')}</span>{chapter.title}</li>)}</ol>
    </article>
  )
}
