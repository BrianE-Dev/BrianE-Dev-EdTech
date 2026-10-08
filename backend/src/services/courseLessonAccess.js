import { Payment } from '../models/index.js'
import { getPaystackConfig } from '../config/paystack.js'
import { isSuperAdmin } from '../utils/authorization.js'

export async function canAccessCourseLesson(user, course, {
  PaymentModel = Payment,
  appEnvironment = getPaystackConfig().appEnvironment,
} = {}) {
  if (isSuperAdmin(user)) return true
  const userId = user?.id || user?._id
  const courseId = course?.id || course?._id
  if (!userId || !courseId) return false
  return Boolean(await PaymentModel.exists({
    user: userId,
    course: courseId,
    application: 'brianedev',
    environment: appEnvironment,
    status: { $in: ['paid', 'successful'] },
  }))
}
