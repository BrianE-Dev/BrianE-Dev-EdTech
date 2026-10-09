import { useState } from 'react'
import { API_URL, api } from '../services/api.js'

async function browserEnglishVoice() {
  let voices = window.speechSynthesis.getVoices()
  if (!voices.length) {
    await Promise.race([new Promise((resolve) => window.speechSynthesis.addEventListener('voiceschanged', resolve, { once: true })), new Promise((resolve) => window.setTimeout(resolve, 1500))])
    voices = window.speechSynthesis.getVoices()
  }
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return englishVoices.find((voice) => /\bsusan\b/i.test(voice.name))
    || englishVoices.find((voice) => voice.lang.toLowerCase() === 'en-gb')
    || englishVoices[0]
    || null
}

function transcriptChunks(text, limit = 2200) {
  const chunks = []
  let remaining = text.trim()
  while (remaining.length > limit) {
    const sentenceBreak = remaining.lastIndexOf('. ', limit)
    const whitespace = remaining.lastIndexOf(' ', limit)
    const splitAt = sentenceBreak > limit * 0.55 ? sentenceBreak + 1 : whitespace > 0 ? whitespace : limit
    chunks.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function speakTranscript(text, voice) {
  const segments = transcriptChunks(text)
  return segments.reduce((queue, segment) => queue.then(() => new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(segment)
    utterance.voice = voice
    utterance.rate = 0.9
    utterance.onend = resolve
    utterance.onerror = (event) => reject(new Error(`Browser narration stopped (${event.error}).`))
    window.speechSynthesis.speak(utterance)
  })), Promise.resolve())
}

export default function BrowserSusanTts({ courseId, chapterId, disabled = false, onBusyChange = () => {}, onSaved = () => {} }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function captureAndSave() {
    if (busy || disabled) return
    setBusy(true); onBusyChange(true); setError(''); setNotice('')
    let displayStream
    let recorder
    try {
      if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder || !window.speechSynthesis) {
        throw new Error('This browser cannot record tab audio. Use a recent desktop version of Chrome or Edge.')
      }
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' })
      const audioTracks = displayStream.getAudioTracks()
      if (!audioTracks.length) throw new Error('No tab audio was shared. Choose “This Tab” and enable “Share tab audio” in the browser prompt.')

      const voice = await browserEnglishVoice()
      if (!voice) throw new Error('No English speech voice is available in this browser. Add an English voice in device speech settings, then reload this page.')

      const transcript = await api(`/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/browser-transcript`)
      if (!transcript.transcript) throw new Error('This chapter has no text to narrate.')
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('This browser cannot encode the captured audio in a supported format.')

      const audioStream = new MediaStream(audioTracks)
      recorder = new MediaRecorder(audioStream, { mimeType })
      const audioParts = []
      recorder.ondataavailable = (event) => { if (event.data.size) audioParts.push(event.data) }
      const recording = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(audioParts, { type: recorder.mimeType || mimeType }))
        recorder.onerror = () => reject(new Error('Browser audio recording failed.'))
      })
      recorder.start(1000)
      setNotice(`Recording ${voice.name}. Keep this tab open until the chapter finishes.`)
      const startedAt = performance.now()
      await speakTranscript(transcript.transcript, voice)
      if (recorder.state !== 'recording') throw new Error('Tab audio sharing ended before narration finished. Start again and keep sharing this tab.')
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      const durationSeconds = Math.max(1, Math.ceil((performance.now() - startedAt) / 1000))
      recorder.stop()
      const blob = await recording
      if (blob.size < 1024) throw new Error('No usable tab audio was recorded. Confirm that tab audio was shared and try again.')

      const response = await fetch(`${API_URL}/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/browser-susan`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': blob.type || mimeType.split(';')[0], 'X-Audio-Duration-Seconds': String(durationSeconds), 'X-Browser-Voice': voice.name, 'X-Browser-Language': voice.lang },
        body: blob,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'The browser recording could not be saved to course audio storage.')
      }
      setNotice(`${voice.name} audio saved for ${chapterId}.`)
      await onSaved()
    } catch (requestError) {
      window.speechSynthesis?.cancel()
      if (recorder?.state === 'recording') recorder.stop()
      setNotice('')
      setError(requestError.message || 'Browser narration could not be saved.')
    } finally {
      displayStream?.getTracks().forEach((track) => track.stop())
      setBusy(false); onBusyChange(false)
    }
  }

  return <div className="admin-browser-tts-action">
    <button className="button button-secondary" type="button" disabled={disabled || busy} onClick={captureAndSave}>{busy ? 'Recording browser voice…' : 'Save browser voice audio'}</button>
    {error && <small role="alert">{error}</small>}
    {notice && <small role="status">{notice}</small>}
  </div>
}
