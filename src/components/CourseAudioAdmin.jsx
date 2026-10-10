import { useCallback, useEffect, useState } from 'react'
import { API_URL, api } from '../services/api.js'
import BrowserSusanTts from './BrowserSusanTts.jsx'

export default function CourseAudioAdmin({ courseId }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState({})

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

  async function uploadChapter(chapterId) {
    const file = selectedFiles[chapterId]
    if (!file) return
    setBusy(true); setNotice(''); setError('')
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      const contentType = file.type || ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', webm: 'audio/webm' }[extension] || '')
      const response = await fetch(`${API_URL}/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/upload`, {
        method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': contentType }, body: file,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Audio upload failed')
      setNotice(`Recording uploaded for ${chapterId}.`)
      setSelectedFiles((files) => ({ ...files, [chapterId]: null }))
      await refresh()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  return <section className="admin-audio-section" aria-labelledby="admin-audio-title">
    <div className="admin-audio-heading"><div><span className="eyebrow">COURSE CONTENT / AUDIO</span><h2 id="admin-audio-title">Course audio</h2><p>Record Edge Read Aloud directly from a shared browser tab, or upload an MP3, WAV, M4A, AAC, OGG, or WebM file (up to 50 MB). Saved audio is stored with the chapter in configured object storage.</p></div><button className="button button-secondary" type="button" onClick={refresh}>{status ? 'Refresh' : 'Load status'}</button></div>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {notice && <p className="admin-audio-notice" role="status">{notice}</p>}
    {!status ? <p>Chapter audio status has not been loaded.</p> : <>
      <div className="admin-audio-summary"><article><span>READY</span><strong>{status.ready}</strong></article><article><span>MISSING</span><strong>{status.missing}</strong></article><article><span>CHANGED / STALE</span><strong>{status.stale}</strong></article><article><span>FAILED</span><strong>{status.failed}</strong></article><article><span>GENERATING</span><strong>{status.generating}</strong></article></div>
      {status.batch?.status === 'running' && <p className="admin-audio-notice" role="status">Batch running{status.batch.currentChapterId ? ` · ${status.batch.currentChapterId}` : ''}.</p>}
      {status.batch && status.batch.status !== 'running' && <p className="admin-audio-batch-state">Last batch: {status.batch.status.replaceAll('_', ' ')} ({status.batch.mode}).</p>}
      <details className="admin-audio-generated-tools"><summary>Optional Gemini narration generation</summary><div className="admin-audio-actions"><button className="button button-primary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('missing')}>{busy ? 'Starting…' : 'Generate missing audio'}</button><button className="button button-secondary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('changed')}>Regenerate changed audio</button></div></details>
      <details className="admin-audio-chapters" open><summary>Chapter status and audio ({status.total})</summary><ol>{status.chapters.map((chapter) => <li key={chapter.chapterId}><span>{String(chapter.number).padStart(2, '0')} · {chapter.title}</span><strong className={`is-${chapter.status}`}>{chapter.status}</strong><div className="admin-audio-chapter-actions"><BrowserSusanTts courseId={courseId} chapterId={chapter.chapterId} disabled={status.batch?.status === 'running'} onBusyChange={setBusy} onSaved={refresh}/><input type="file" disabled={busy} accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm" aria-label={`Audio recording for ${chapter.title}`} onChange={(event) => setSelectedFiles((files) => ({ ...files, [chapter.chapterId]: event.target.files?.[0] || null }))}/><button type="button" className="button button-primary" disabled={busy || !selectedFiles[chapter.chapterId]} onClick={() => uploadChapter(chapter.chapterId)}>{busy ? 'Uploading…' : 'Upload recording'}</button><button type="button" className="button button-secondary" disabled={busy || chapter.status === 'generating' || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId)}>{chapter.status === 'ready' ? 'Generate / check' : 'Generate this chapter'}</button>{chapter.status === 'ready' && <button type="button" className="button button-secondary" disabled={busy || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId, true)}>Regenerate</button>}</div>{chapter.error && <small>{chapter.error}</small>}</li>)}</ol></details>
    </>}
  </section>
}
