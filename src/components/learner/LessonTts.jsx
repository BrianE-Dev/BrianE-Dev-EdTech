import { useEffect, useState } from 'react'

const excludedNarrationContent = '.reader-tts, .reader-completion, .reader-chapter-navigation, button, input, select, textarea, .sr-only'
const preferredFemaleVoice = /\b(samantha|ava|aria|jenny|zira|salli|joanna|kendra|kimberly|ivy|serena|sonia|libby)\b|google us english|english.*female|female/i

function voiceId(voice) {
  return `${voice.voiceURI}|${voice.name}|${voice.lang}`
}

function findPreferredFemaleVoice(voices) {
  return voices.find((voice) => preferredFemaleVoice.test(voice.name))
    || voices.find((voice) => /female/i.test(voice.voiceURI))
    || null
}

function getEnglishVoices() {
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
}

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

export default function LessonTts() {
  const [state, setState] = useState('idle')
  const [voices, setVoices] = useState([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [voiceMessage, setVoiceMessage] = useState('')
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  useEffect(() => {
    if (!supported) return undefined
    let active = true
    const refreshVoices = () => {
      const availableVoices = getEnglishVoices()
      if (!active) return
      setVoices(availableVoices)
      setSelectedVoiceId((current) => current || (findPreferredFemaleVoice(availableVoices) ? voiceId(findPreferredFemaleVoice(availableVoices)) : ''))
    }
    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    return () => {
      active = false
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  if (!supported) return <p className="reader-tts-unavailable" role="status">Audio narration is not supported in this browser. You can still read the lesson.</p>

  function play() {
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('playing')
      return
    }

    setVoiceMessage('')
    const availableVoices = voices.length ? voices : getEnglishVoices()
    const selectedVoice = availableVoices.find((voice) => voiceId(voice) === selectedVoiceId)
      || findPreferredFemaleVoice(availableVoices)
    if (!selectedVoice) {
      setVoiceMessage(availableVoices.length
        ? 'Choose an English voice. This browser does not identify voice gender, so select one that sounds right to you.'
        : 'No English speech voices are available in this browser. Add an English voice in your device settings and try again.')
      return
    }
    setSelectedVoiceId(voiceId(selectedVoice))

    const text = getVisibleLessonText()
    if (!text) {
      setVoiceMessage('No lesson text was found to read.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = selectedVoice
    utterance.rate = 0.86
    utterance.pitch = 1.03
    utterance.onstart = () => setState('playing')
    utterance.onend = () => setState('idle')
    utterance.onerror = (event) => {
      setState('idle')
      setVoiceMessage('Narration could not start (' + event.error + '). Try another voice.')
    }
    window.speechSynthesis.speak(utterance)
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
    {voices.length > 0 && <label className="reader-tts-voice">Voice
      <select value={selectedVoiceId} onChange={(event) => setSelectedVoiceId(event.target.value)} aria-label="Narration voice">
        <option value="">Choose a voice</option>
        {voices.map((voice) => <option key={voiceId(voice)} value={voiceId(voice)}>{voice.name} ({voice.lang})</option>)}
      </select>
    </label>}
    {state === 'playing' ? <button type="button" onClick={pause} aria-label="Pause narration">Pause</button> : <button type="button" onClick={play}>{state === 'paused' ? 'Resume' : 'Play'}</button>}
    {state !== 'idle' && <button className="reader-tts-stop" type="button" onClick={stop}>Stop</button>}
    {voiceMessage && <span className="reader-tts-message" role="status">{voiceMessage}</span>}
    <span className="sr-only" aria-live="polite">{state === 'playing' ? 'Narration playing' : state === 'paused' ? 'Narration paused' : ''}</span>
  </section>
}
