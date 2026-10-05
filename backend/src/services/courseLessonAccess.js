import { Payment } from '../models/index.js'
import { getPaystackConfig } from '../config/paystack.js'

export async function canAccessCourseLesson(user, course, {
  PaymentModel = Payment,
  appEnvironment = getPaystackConfig().appEnvironment,
} = {}) {
  if (!user?.id || !course?.id) return false
  return Boolean(await PaymentModel.exists({
    user: user.id,
    course: course.id,
    application: 'brianedev',
    environment: appEnvironment,
    status: { $in: ['paid', 'successful'] },
  }))
}
