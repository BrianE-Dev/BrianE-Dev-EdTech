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
      <ol className="chapter-list" id={chaptersId} hidden={!chaptersOpen}>{section.chapters.map((chapter) => <li key={chapter.id}>
        <span>{String(chapter.number).padStart(2, '0')}</span><strong>{chapter.title}</strong>
        {chapter.id === 'chapter-ai-assisted-developer'
          ? <a className="chapter-access-preview" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">Preview available</a>
          : <a className="chapter-access-locked" href="/#pricing">Purchase required</a>}
      </li>)}</ol>
      {section.chapters.some((chapter) => chapter.id === 'chapter-ai-assisted-developer') && <a className="curriculum-preview-cta" href="/courses/ai-powered-developer-productivity/learn/chapter-ai-assisted-developer">Start Chapter 1 Preview <Icon name="arrow" size={13}/></a>}
    </article>
  )
}
