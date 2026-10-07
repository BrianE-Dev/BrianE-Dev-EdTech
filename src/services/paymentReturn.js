export function getPaymentReturnState(reference, response) {
  if (!reference) return { state: 'error', message: 'Payment reference is missing. Check your purchases or contact support.' }
  if (response?.status === 'paid' || response?.status === 'successful') {
    return { state: 'confirmed', message: 'Payment confirmed. Your course access is ready.' }
  }
  if (response?.status === 'pending' || response?.status === 'processing') {
    return { state: 'pending', message: 'Payment is still being verified. You can check again shortly.' }
  }
  return { state: 'error', message: 'We could not confirm this payment. You can retry verification or contact support.' }
}
