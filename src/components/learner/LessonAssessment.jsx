import { useState } from 'react'
import { submitAssessment } from '../../services/api.js'

export default function LessonAssessment({ courseId, chapterId, assessments, onCompleted }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!assessments.length) return null

  async function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    const missingRequired = assessments.some((assessment) => assessment.required && !answers[assessment.id])
    if (missingRequired) {
      setError('Answer each required question before submitting.')
      return
    }
    const submittedAnswers = assessments
      .filter((assessment) => answers[assessment.id])
      .map((assessment) => ({ questionId: assessment.id, optionId: answers[assessment.id] }))
    setBusy(true)
    try {
      const response = await submitAssessment(courseId, chapterId, submittedAnswers)
      setResult(response.assessment)
      await onCompleted?.(response)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="reader-assessment" aria-labelledby="assessment-heading">
    <span className="eyebrow">KNOWLEDGE CHECK</span><h2 id="assessment-heading">Check your understanding</h2>
    <form onSubmit={submit}>
      {assessments.map((assessment, index) => <fieldset key={assessment.id}>
        <legend><span>Question {index + 1}</span>{assessment.required && <small>Required</small>}</legend>
        <p>{assessment.prompt}</p>
        {assessment.options.map((option) => <label className="reader-option" key={option.id}>
          <input type="radio" name={assessment.id} value={option.id} checked={answers[assessment.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [assessment.id]: option.id }))}/>
          <span>{option.text}</span>
        </label>)}
      </fieldset>)}
      {error && <p className="reader-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy || Boolean(result?.passed)}>{busy ? 'Checking answers…' : result?.passed ? 'Requirement passed' : 'Submit answers'}</button>
    </form>
    {result && <div className={`reader-assessment-result ${result.passed ? 'is-passed' : 'is-not-passed'}`} role="status">
      <strong>{result.passed ? 'Assessment requirement passed' : 'Try again'}</strong>
      <p>Score: {Math.round(result.score * 100)}% ({result.correctAnswers} of {result.totalQuestions}). Attempt {result.attemptNumber}.</p>
      {!result.passed && <p>You can make another attempt. Correct answers and explanations are not shown here.</p>}
    </div>}
  </section>
}
