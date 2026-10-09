import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'
import BrowserSusanTts from './BrowserSusanTts.jsx'

export default function CourseAudioAdmin({ courseId }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const result = await api(`/admin/tts/courses/${encodeURIComponent(courseId)}/status`)
      setStatus(result)
      setHasLoaded(true)
      setError('')
    } catch (requestError) { setError(requestError.message) }
  }, [courseId])

  useEffect(() => {
    if (!hasLoaded) return undefined
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [hasLoaded, refresh])
  useEffect(() => {
    if (!hasLoaded || status?.batch?.status !== 'running') return undefined
    const timer = window.setInterval(refresh, 4000)
    return () => window.clearInterval(timer)
  }, [hasLoaded, status?.batch?.status, refresh])

  async function start(mode) {
    setBusy(true); setNotice(''); setError('')
    try {
      const result = await api(`/admin/tts/courses/${encodeURIComponent(courseId)}/generate-missing`, { method: 'POST', body: JSON.stringify({ mode }) })
      setNotice(result.alreadyRunning ? 'Audio generation is already running. Showing the active batch.' : `${mode === 'changed' ? 'Changed and missing' : 'Missing'} chapter audio generation started.`)
      await refresh()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  async function startChapter(chapterId, force = false) {
    setBusy(true); setNotice(''); setError('')
    try {
      const result = await api(`/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/generate`, { method: 'POST', body: JSON.stringify({ force }) })
      setNotice(result.status === 'ready' ? 'Chapter audio is ready.' : `Audio generation started for ${chapterId}.`)
      await refresh()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  return <section className="admin-audio-section" aria-labelledby="admin-audio-title">
    <div className="admin-audio-heading"><div><span className="eyebrow">COURSE CONTENT / AUDIO</span><h2 id="admin-audio-title">Course audio</h2><p>Generate Gemini narration or save a browser recording with an available English speech voice (Susan is preferred when installed). For browser recording, choose “This Tab” and enable “Share tab audio”. Playback uses saved audio and never calls Gemini.</p></div><button className="button button-secondary" type="button" onClick={refresh}>{status ? 'Refresh' : 'Load status'}</button></div>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {notice && <p className="admin-audio-notice" role="status">{notice}</p>}
    {!status ? <p>Chapter audio status has not been loaded.</p> : <>
      <div className="admin-audio-summary"><article><span>READY</span><strong>{status.ready}</strong></article><article><span>MISSING</span><strong>{status.missing}</strong></article><article><span>CHANGED / STALE</span><strong>{status.stale}</strong></article><article><span>FAILED</span><strong>{status.failed}</strong></article><article><span>GENERATING</span><strong>{status.generating}</strong></article></div>
      {status.batch?.status === 'running' && <p className="admin-audio-notice" role="status">Batch running{status.batch.currentChapterId ? ` · ${status.batch.currentChapterId}` : ''}.</p>}
      {status.batch && status.batch.status !== 'running' && <p className="admin-audio-batch-state">Last batch: {status.batch.status.replaceAll('_', ' ')} ({status.batch.mode}).</p>}
      <div className="admin-audio-actions"><button className="button button-primary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('missing')}>{busy ? 'Starting…' : 'Generate missing audio'}</button><button className="button button-secondary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('changed')}>Regenerate changed audio</button></div>
      <details className="admin-audio-chapters"><summary>Chapter status and generation ({status.total})</summary><ol>{status.chapters.map((chapter) => <li key={chapter.chapterId}><span>{String(chapter.number).padStart(2, '0')} · {chapter.title}</span><strong className={`is-${chapter.status}`}>{chapter.status}</strong><div className="admin-audio-chapter-actions"><button type="button" className="button button-secondary" disabled={busy || chapter.status === 'generating' || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId)}>{chapter.status === 'ready' ? 'Generate / check' : 'Generate this chapter'}</button>{chapter.status === 'ready' && <button type="button" className="button button-secondary" disabled={busy || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId, true)}>Regenerate</button>}<BrowserSusanTts courseId={courseId} chapterId={chapter.chapterId} disabled={busy || chapter.status === 'generating' || status.batch?.status === 'running'} onBusyChange={setBusy} onSaved={refresh}/></div>{chapter.error && <small>{chapter.error}</small>}</li>)}</ol></details>
    </>}
  </section>
}
