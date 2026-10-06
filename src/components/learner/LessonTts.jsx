import { useEffect, useState } from 'react'

export default function LessonTts({ text }) {
  const [state, setState] = useState('idle')
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported, text])

  if (!text) return null
  if (!supported) return <p className="reader-tts-unavailable" role="status">Audio narration is not supported in this browser. You can still read the lesson.</p>

  function play() {
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('playing')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setState('idle')
    utterance.onerror = () => setState('idle')
    window.speechSynthesis.speak(utterance)
    setState('playing')
  }

  function pause() {
    window.speechSynthesis.pause()
    setState('paused')
  }

  function stop() {
    window.speechSynthesis.cancel()
    setState('idle')
  }

  return <section className="reader-tts" aria-label="Lesson narration">
    <div><strong>Listen to this lesson</strong><span>Audio is optional and does not affect completion.</span></div>
    {state === 'playing' ? <button type="button" onClick={pause} aria-label="Pause narration">Pause</button> : <button type="button" onClick={play}>{state === 'paused' ? 'Resume' : 'Play'}</button>}
    {state !== 'idle' && <button className="reader-tts-stop" type="button" onClick={stop}>Stop</button>}
    <span className="sr-only" aria-live="polite">{state === 'playing' ? 'Narration playing' : state === 'paused' ? 'Narration paused' : ''}</span>
  </section>
}
