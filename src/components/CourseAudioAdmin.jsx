import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'

function audioRequestError(error) {
  const guidance = {
    authentication_error: 'Object storage rejected its credentials (401). Check the storage access key and secret in the API service environment.',
    permission_error: 'Object storage denied access (403). Check bucket permissions for reading and writing audio objects.',
    missing_object: 'Object storage confirmed that this audio object is missing (404). The saved audio reference was left unchanged.',
    storage_target_not_found: 'Object storage returned 404 during upload. Check that the configured bucket exists at the configured endpoint.',
    storage_http_404: 'Object storage returned 404 without identifying a missing key or bucket. Check the endpoint and bucket configuration.',
    storage_configuration_error: 'Object storage configuration is incomplete or invalid. Check the provider, endpoint, region, bucket, and credentials in the API service environment.',
    dns_error: 'The API could not resolve the object storage host. Check the configured storage endpoint and API network access.',
    tls_error: 'The API could not establish a secure connection to object storage. Check the endpoint and TLS configuration.',
    timeout: 'The object storage request timed out. Check storage availability and API network access.',
    connection_error: 'The API could not connect to object storage. Check the endpoint and API network access.',
    provider_http_500: 'Object storage returned a server error (500). Check the storage provider status and API logs.',
    provider_http_502: 'Object storage returned a server error (502). Check the storage provider status and API logs.',
    provider_http_503: 'Object storage is temporarily unavailable (503). Check the storage provider status and API logs.',
  }
  if (error?.code !== 'AUDIO_STORAGE_UNAVAILABLE') return error?.message || 'Audio request failed.'
  return `${guidance[error.storageIssue] || `Object storage request failed (${error.storageIssue || 'unknown cause'}). Check the API service logs and storage configuration.`} The chapter request could not complete until storage is available.`
}

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
    } catch (requestError) { setError(audioRequestError(requestError)) } finally { setBusy(false) }
  }

  async function startChapter(chapterId, force = false) {
    setBusy(true); setNotice(''); setError('')
    try {
      const result = await api(`/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/generate`, { method: 'POST', body: JSON.stringify({ force }) })
      setNotice(result.status === 'ready' ? 'Chapter audio is ready.' : `Audio generation started for ${chapterId}.`)
      await refresh()
    } catch (requestError) { setError(audioRequestError(requestError)) } finally { setBusy(false) }
  }

  return <section className="admin-audio-section" aria-labelledby="admin-audio-title">
    <div className="admin-audio-heading"><div><span className="eyebrow">COURSE CONTENT / AUDIO</span><h2 id="admin-audio-title">Course audio</h2><p>Check narration status or generate chapter audio with Gemini. Generated audio is stored with the chapter in configured object storage.</p></div><button className="button button-secondary" type="button" onClick={refresh}>{status ? 'Refresh' : 'Load status'}</button></div>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {notice && <p className="admin-audio-notice" role="status">{notice}</p>}
    {!status ? <p>Chapter audio status has not been loaded.</p> : <>
      <div className="admin-audio-summary"><article><span>READY</span><strong>{status.ready}</strong></article><article><span>MISSING</span><strong>{status.missing}</strong></article><article><span>CHANGED / STALE</span><strong>{status.stale}</strong></article><article><span>FAILED</span><strong>{status.failed}</strong></article><article><span>GENERATING</span><strong>{status.generating}</strong></article></div>
      {status.batch?.status === 'running' && <p className="admin-audio-notice" role="status">Batch running{status.batch.currentChapterId ? ` · ${status.batch.currentChapterId}` : ''}.</p>}
      {status.batch && status.batch.status !== 'running' && <p className="admin-audio-batch-state">Last batch: {status.batch.status.replaceAll('_', ' ')} ({status.batch.mode}).</p>}
      <details className="admin-audio-generated-tools"><summary>Optional Gemini narration generation</summary><div className="admin-audio-actions"><button className="button button-primary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('missing')}>{busy ? 'Starting…' : 'Generate missing audio'}</button><button className="button button-secondary" type="button" disabled={busy || status.batch?.status === 'running'} onClick={() => start('changed')}>Regenerate changed audio</button></div></details>
      <details className="admin-audio-chapters" open><summary>Chapter status and audio ({status.total})</summary><ol>{status.chapters.map((chapter) => <li key={chapter.chapterId}><span>{String(chapter.number).padStart(2, '0')} · {chapter.title}</span><strong className={`is-${chapter.status}`}>{chapter.status}{chapter.status === 'stale' ? (chapter.playable ? ' · saved audio playable' : ' · saved object unavailable') : ''}</strong><div className="admin-audio-chapter-actions"><button type="button" className="button button-secondary" disabled={busy || chapter.status === 'generating' || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId)}>{chapter.status === 'ready' ? 'Generate / check' : 'Generate this chapter'}</button>{chapter.status === 'ready' && <button type="button" className="button button-secondary" disabled={busy || status.batch?.status === 'running'} onClick={() => startChapter(chapter.chapterId, true)}>Regenerate</button>}</div>{chapter.error && <small>{chapter.error}</small>}</li>)}</ol></details>
    </>}
  </section>
}
