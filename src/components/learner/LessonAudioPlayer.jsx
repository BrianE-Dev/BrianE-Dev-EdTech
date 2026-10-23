import { useEffect, useRef, useState } from 'react'
import { getLessonAudio } from '../../services/api.js'
import LessonTts from './LessonTts.jsx'

const playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2]

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const value = Math.floor(seconds)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function LessonAudioPlayer({ courseId, chapterId }) {
  const audioRef = useRef(null)
  const [status, setStatus] = useState('ready')
  const [message, setMessage] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [playWhenReady, setPlayWhenReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState(1)

  useEffect(() => {
    if (!audioUrl || !playWhenReady || !audioRef.current) return
    audioRef.current.play().then(() => setPlayWhenReady(false)).catch(() => {
      setPlayWhenReady(false)
      setStatus('error')
      setMessage('Audio playback could not start in this browser.')
    })
  }, [audioUrl, playWhenReady])

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  async function play() {
    setMessage('')
    if (audioRef.current && audioUrl) {
      try { await audioRef.current.play() } catch { setStatus('error'); setMessage('Audio playback could not start in this browser.') }
      return
    }
    setStatus('loading')
    try {
      const blob = await getLessonAudio(courseId, chapterId)
      setAudioUrl(URL.createObjectURL(blob))
      setStatus('ready')
      setPlayWhenReady(true)
    } catch (error) {
      setStatus(error.code === 'AUDIO_NOT_GENERATED' ? 'missing' : 'error')
      setMessage(error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Loading saved Gemini audio took too long.'
        : error.message)
    }
  }

  function pause() {
    audioRef.current?.pause()
  }

  function retryGemini() {
    audioRef.current?.pause()
    setAudioUrl('')
    setPlayWhenReady(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setMessage('')
    setStatus('ready')
  }

  if (status === 'unavailable' || status === 'missing' || status === 'error') return <LessonTts fallbackMessage={status === 'missing'
    ? 'Gemini narration is not ready for this chapter yet. Using browser speech.'
    : `Saved Gemini audio could not be played${message ? `: ${message}` : ''}. Using browser speech.`} onRetryGemini={retryGemini} />

  const percent = duration ? (currentTime / duration) * 100 : 0
  return <section className="reader-audio-player" aria-label="Lesson audio player">
    <audio ref={audioRef} src={audioUrl || undefined} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => setPlaying(false)} onError={() => { setStatus('error'); setMessage('The saved lesson audio could not be played.') }}/>
    <div className="reader-audio-heading"><div><strong>Course narration</strong><span>Saved chapter audio</span></div>{status === 'loading' ? <span role="status">Loading audio…</span> : <button type="button" onClick={playing ? pause : play} disabled={status === 'loading'}>{playing ? 'Pause' : audioUrl ? 'Play' : 'Load & play'}</button>}</div>
    {audioUrl && <>
      <div className="reader-audio-progress"><input aria-label="Audio position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} style={{ '--audio-progress': `${percent}%` }} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value) }}/><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div>
      <div className="reader-audio-options"><label>Speed<select value={rate} onChange={(event) => { const next = Number(event.target.value); setRate(next); if (audioRef.current) audioRef.current.playbackRate = next }}>{playbackRates.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label><label>Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next }}/></label></div>
    </>}
    {message && <span role="status">{message}</span>}
  </section>
}
