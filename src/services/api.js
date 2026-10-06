export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api')

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  let body = null
  if (response.status !== 204) {
    try { body = await response.json() } catch { body = null }
  }
  if (!response.ok) {
    const error = new Error(typeof body?.error === 'string' ? body.error : 'Request failed')
    error.status = response.status
    error.code = body?.code
    throw error
  }
  return body
}

const jsonBody = (value) => JSON.stringify(value)

export const getCurrentUser = () => api('/auth/me')
export const loginLearner = (email, password) => api('/auth/login', { method: 'POST', body: jsonBody({ email, password }) })
export const registerLearner = (name, email, password) => api('/auth/register', { method: 'POST', body: jsonBody({ name, email, password }) })
export const logoutUser = () => api('/auth/logout', { method: 'POST' })
export const getPurchases = () => api('/me/purchases')
export const getCourse = (slug) => api(`/courses/${encodeURIComponent(slug)}`)
export const getCourseProgress = (courseId) => api(`/courses/${encodeURIComponent(courseId)}/progress`)
export const getLesson = (courseId, chapterId) => api(`/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}`)
export const updateLessonProgress = (courseId, chapterId, status) => api(
  `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/progress`,
  { method: 'POST', body: jsonBody({ status }) },
)
export const submitAssessment = (courseId, chapterId, answers) => api(
  `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/assessment`,
  { method: 'POST', body: jsonBody({ answers }) },
)
export const completeExercise = (courseId, chapterId, exerciseId) => api(
  `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/exercises/${encodeURIComponent(exerciseId)}/complete`,
  { method: 'POST', body: jsonBody({}) },
)
export const getCertificates = () => api('/me/certificates')

export function lessonImageUrl(courseId, chapterId, source) {
  const query = new URLSearchParams({ src: source })
  return `${API_URL}/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/assets?${query}`
}
