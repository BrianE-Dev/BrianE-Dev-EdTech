export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api')

async function responseJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = response.status === 204 ? null : await responseJson(response)
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
export const getLearnerProfile = () => api('/me/profile')
export const saveLearnerProfile = (profile) => api('/me/profile', { method: 'PUT', body: jsonBody(profile) })
export const getAdminLearners = () => api('/admin/learners')
export const loginLearner = (email, password) => api('/auth/login', { method: 'POST', body: jsonBody({ email, password }) })
export const registerLearner = (name, email, password) => api('/auth/register', { method: 'POST', body: jsonBody({ name, email, password }) })
export const logoutUser = () => api('/auth/logout', { method: 'POST' })
export const getPurchases = () => api('/me/purchases')
export const getCourse = (slug) => api(`/courses/${encodeURIComponent(slug)}`)
export const getCourseProgress = (courseId) => api(`/courses/${encodeURIComponent(courseId)}/progress`)
export const getLesson = (courseId, chapterId) => api(`/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}`)
export const getLessonPreview = (courseSlug, chapterId) => api(`/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(chapterId)}/preview`)
export const getLessonAudioStatus = (courseId, chapterId) => api(`/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/audio/status`)
export async function getLessonAudio(courseId, chapterId) {
  const response = await fetch(`${API_URL}/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/audio`, { credentials: 'include', cache: 'no-store' })
  if (!response.ok) {
    const body = await responseJson(response)
    const error = new Error(typeof body?.error === 'string' ? body.error : 'Lesson audio could not be loaded')
    error.status = response.status
    error.code = body?.code
    throw error
  }
  return response.blob()
}
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
export const getCertificateDownloadUrl = (certificateId) => `${API_URL}/me/certificates/${encodeURIComponent(certificateId)}/download`
export const getCertificateVerificationUrl = (certificateId) => `${API_URL}/certificates/verify/${encodeURIComponent(certificateId)}`
export const getCourseEbookUrl = (courseId) => `${API_URL}/courses/${encodeURIComponent(courseId)}/ebook`
export const getCourseEbookStatus = (courseId) => api(`/courses/${encodeURIComponent(courseId)}/ebook/status`)

export function lessonImageUrl(courseId, chapterId, source) {
  const query = new URLSearchParams({ src: source })
  return `${API_URL}/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterId)}/assets?${query}`
}
