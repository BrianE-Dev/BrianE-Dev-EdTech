function chapterHref(courseSlug, chapter) {
  return chapter ? `/courses/${encodeURIComponent(courseSlug)}/learn/${encodeURIComponent(chapter.chapterId)}` : null
}

export default function ChapterNavigation({ courseSlug, previous, next }) {
  return <nav className="reader-chapter-navigation" aria-label="Chapter navigation">
    {previous ? <a className="reader-nav-link reader-nav-previous" href={chapterHref(courseSlug, previous)}><span>Previous chapter</span><strong>{previous.number}. {previous.title}</strong></a> : <span/>}
    {next ? <a className="reader-nav-link reader-nav-next" href={chapterHref(courseSlug, next)}><span>Next chapter</span><strong>{next.number}. {next.title}</strong></a> : <span/>}
  </nav>
}
