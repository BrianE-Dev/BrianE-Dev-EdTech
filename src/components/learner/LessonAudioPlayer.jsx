import { useEffect, useRef, useState } from 'react'
import { getLessonAudioUrl } from '../../services/api.js'
import LessonTts from './LessonTts.jsx'

const playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2]

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const value = Math.floor(seconds)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function LessonAudioPlayer({ courseId, chapterId }) {
  const audioRef = useRef(null)
  const loadTimeoutRef = useRef(null)
  const [status, setStatus] = useState('ready')
  const [message, setMessage] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState(1)

  useEffect(() => () => window.clearTimeout(loadTimeoutRef.current), [])

  async function play() {
    setMessage('')
    const audio = audioRef.current
    if (!audio) return
    setStatus('loading')
    window.clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = window.setTimeout(() => {
      audio.pause()
      setStatus('error')
      setMessage('Audio narration did not start within 90 seconds.')
    }, 90000)
    try {
      await audio.play()
    } catch (error) {
      window.clearTimeout(loadTimeoutRef.current)
      setStatus('error')
      setMessage(error.message || 'Audio narration could not start in this browser.')
    }
  }

  function pause() {
    audioRef.current?.pause()
  }

  function retryGemini() {
    audioRef.current?.pause()
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setMessage('')
    setStatus('ready')
    setRetryCount((count) => count + 1)
    window.clearTimeout(loadTimeoutRef.current)
  }

  if (status === 'unavailable' || status === 'missing' || status === 'error') return <LessonTts fallbackMessage={status === 'missing'
    ? 'Audio narration is not ready for this chapter yet. Using browser speech.'
    : `Audio narration could not be played${message ? `: ${message}` : ''}. Using browser speech.`} onRetryGemini={retryGemini} />

  const percent = duration ? (currentTime / duration) * 100 : 0
  const audioUrl = `${getLessonAudioUrl(courseId, chapterId)}${retryCount ? `?retry=${retryCount}` : ''}`
  return <section className="reader-audio-player" aria-label="Lesson audio player">
    <audio ref={audioRef} src={audioUrl} crossOrigin="use-credentials" preload="none" onPlay={() => { window.clearTimeout(loadTimeoutRef.current); setStatus('ready'); setPlaying(true) }} onPause={() => setPlaying(false)} onCanPlay={() => { window.clearTimeout(loadTimeoutRef.current); setStatus('ready') }} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => setPlaying(false)} onError={(event) => { window.clearTimeout(loadTimeoutRef.current); const code = event.currentTarget.error?.code; const reason = ({ 1: 'playback was aborted', 2: 'the audio request failed', 3: 'the WAV data could not be decoded', 4: 'the browser does not support this audio format' })[code] || 'the saved audio could not be played'; setStatus('error'); setMessage(`Audio playback error ${code || 'unknown'}: ${reason}.`) }}/>
    <div className="reader-audio-heading"><div><strong>Audio narration</strong><span>Course lesson audio</span></div>{status === 'loading' ? <span role="status">Loading audio…</span> : <button type="button" onClick={playing ? pause : play} disabled={status === 'loading'}>{playing ? 'Pause' : 'Play narration'}</button>}</div>
    {duration > 0 && <>
      <div className="reader-audio-progress"><input aria-label="Audio position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} style={{ '--audio-progress': `${percent}%` }} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value) }}/><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div>
      <div className="reader-audio-options"><label>Speed<select value={rate} onChange={(event) => { const next = Number(event.target.value); setRate(next); if (audioRef.current) audioRef.current.playbackRate = next }}>{playbackRates.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label><label>Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next }}/></label></div>
    </>}
    {message && <span role="status">{message}</span>}
  </section>
}
