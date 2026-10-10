import { useRef, useState } from 'react'
import { API_URL } from '../services/api.js'

const MAX_AUDIO_BYTES = 50 * 1024 * 1024

export default function BrowserSusanTts({ courseId, chapterId, disabled = false, onBusyChange = () => {}, onSaved = () => {} }) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const tooLargeRef = useRef(false)

  function releaseCapture() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setRecording(false)
  }

  async function saveRecording(blob, mimeType) {
    if (tooLargeRef.current || blob.size > MAX_AUDIO_BYTES) {
      throw new Error('This recording is over 50 MB. Record a shorter chapter or use a compressed format.')
    }
    if (blob.size < 1024) throw new Error('No usable audio was captured. Confirm that tab audio sharing is enabled and try again.')
    const type = (blob.type || mimeType).split(';')[0].toLowerCase()
    const response = await fetch(`${API_URL}/admin/tts/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/upload`, {
      method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': type }, body: blob,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(result?.error || 'Audio upload failed')
    setNotice(`Recording saved for ${chapterId}.`)
    await onSaved()
  }

  async function startRecording() {
    if (busy || recording || disabled) return
    setBusy(true); onBusyChange(true); setError(''); setNotice('')
    try {
      if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
        throw new Error('Tab audio recording requires a recent desktop browser on HTTPS or localhost.')
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' }, audio: true, preferCurrentTab: false,
      })
      streamRef.current = stream
      const audioTracks = stream.getAudioTracks()
      if (!audioTracks.length) throw new Error('No tab audio was shared. Choose the chapter browser tab and enable “Share tab audio” in the browser prompt.')
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('This browser cannot encode captured tab audio in a supported format.')

      const recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []
      tooLargeRef.current = false
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return
        chunksRef.current.push(event.data)
        if (chunksRef.current.reduce((size, chunk) => size + chunk.size, 0) > MAX_AUDIO_BYTES) {
          tooLargeRef.current = true
          if (recorder.state === 'recording') recorder.stop()
        }
      }
      recorder.onerror = () => setError('Browser audio recording failed.')
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType })
        chunksRef.current = []
        releaseCapture()
        setBusy(true); onBusyChange(true)
        try { await saveRecording(blob, mimeType) } catch (saveError) { setError(saveError.message) }
        finally { setBusy(false); onBusyChange(false) }
      }
      recorder.start(1000)
      setRecording(true)
      setNotice('Recording shared tab audio. Switch to the chapter tab and start Edge Read Aloud; return here and stop when it finishes.')
      setBusy(false)
      stream.getVideoTracks().forEach((track) => { track.onended = () => { if (recorder.state === 'recording') recorder.stop() } })
    } catch (requestError) {
      releaseCapture()
      setError(requestError.message || 'Could not start tab audio capture.')
      setBusy(false); onBusyChange(false)
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
  }

  return <div className="admin-browser-tts-action">
    <button className="button button-secondary" type="button" disabled={disabled || busy} onClick={recording ? stopRecording : startRecording}>
      {busy ? 'Saving recording…' : recording ? 'Stop and save tab audio' : 'Record Edge tab audio'}
    </button>
    <small>Open the chapter in another tab. Start recording here, choose that tab and enable tab audio, then play Edge Read Aloud and return here to stop and save.</small>
    {error && <small role="alert">{error}</small>}
    {notice && <small role="status">{notice}</small>}
  </div>
}
