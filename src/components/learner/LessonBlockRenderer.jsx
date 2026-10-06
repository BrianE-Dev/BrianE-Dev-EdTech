import { lessonImageUrl } from '../../services/api.js'

function UnknownBlock() {
  if (import.meta.env.DEV) console.warn('Unsupported lesson block received; displaying a safe fallback.')
  return <p className="lesson-unknown-block" role="note">This content block cannot be displayed.</p>
}

export default function LessonBlockRenderer({ blocks, courseId, chapterId }) {
  return <div className="lesson-blocks">{blocks.map((block, index) => {
    switch (block.type) {
      case 'heading': {
        const Heading = `h${block.level}`
        return <Heading key={`heading-${index}`}>{block.text}</Heading>
      }
      case 'paragraph': return <p key={`paragraph-${index}`}>{block.text}</p>
      case 'list': return <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
      case 'ordered-list': return <ol key={`ordered-${index}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol>
      case 'code': return <figure className="reader-code" key={`code-${index}`}>
        {(block.filename || block.language) && <figcaption>{block.filename || block.language}{block.filename && <span>{block.language}</span>}</figcaption>}
        <pre><code>{block.code}</code></pre>
        {block.caption && <p>{block.caption}</p>}
      </figure>
      case 'callout': return <aside className={`reader-callout reader-callout-${block.variant}`} key={`callout-${index}`}><strong>{block.title}</strong><p>{block.text}</p></aside>
      case 'quote': return <blockquote key={`quote-${index}`}><p>{block.text}</p>{block.attribution && <cite>{block.attribution}</cite>}</blockquote>
      case 'table': return <div className="reader-table-scroll" key={`table-${index}`}><table><thead><tr>{block.headers.map((header, cellIndex) => <th scope="col" key={cellIndex}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
      case 'image': return <figure className="reader-image" key={`image-${index}`}><img src={lessonImageUrl(courseId, chapterId, block.src)} alt={block.alt}/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
      case 'divider': return <hr key={`divider-${index}`}/>
      default: return <UnknownBlock key={`unknown-${index}`}/>
    }
  })}</div>
}
