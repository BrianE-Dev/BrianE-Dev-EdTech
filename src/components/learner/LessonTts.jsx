import { useEffect, useState } from 'react'

const excludedNarrationContent = '.reader-tts, .reader-completion, .reader-chapter-navigation, button, input, select, textarea, .sr-only'
const preferredFemaleVoice = /samantha|ava|aria|jenny|zira|salli|joanna|kendra|kimberly|ivy|serena|female|google us english/i

function getVisibleLessonText() {
  const source = document.querySelector('.reader-main')
  if (!source) return ''

  const copy = source.cloneNode(true)
  copy.querySelectorAll(excludedNarrationContent).forEach((element) => element.remove())
  copy.querySelectorAll('details:not([open])').forEach((details) => {
    Array.from(details.children).filter((child) => child.tagName !== 'SUMMARY').forEach((child) => child.remove())
  })

  const staging = document.createElement('div')
  staging.setAttribute('aria-hidden', 'true')
  Object.assign(staging.style, { position: 'fixed', left: '-100000px', top: '0', width: '800px', opacity: '0', pointerEvents: 'none' })
  staging.append(copy)
  document.body.append(staging)
  const text = copy.innerText || copy.textContent || ''
  staging.remove()

  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).join('. ')
}

function getPreferredVoice() {
  const voices = window.speechSynthesis.getVoices()
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return englishVoices.find((voice) => preferredFemaleVoice.test(voice.name))
    || englishVoices.find((voice) => /female/i.test(voice.voiceURI))
    || englishVoices[0]
    || null
}

export default function LessonTts() {
  const [state, setState] = useState('idle')
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  if (!supported) return <p className="reader-tts-unavailable" role="status">Audio narration is not supported in this browser. You can still read the lesson.</p>

  function play() {
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('playing')
      return
    }
    const text = getVisibleLessonText()
    if (!text) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = getPreferredVoice()
    utterance.rate = 0.9
    utterance.pitch = 1
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
