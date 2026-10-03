export function getFinalPrice(config, now = new Date()) {
  if (!config?.active) throw Object.assign(new Error('Pricing is unavailable'), { status: 503 })
  const promotionActive = config.discountEnabled && (!config.startDate || config.startDate <= now) && (!config.endDate || config.endDate >= now)
  const discount = !promotionActive ? 0 : config.discountType === 'percentage'
    ? config.originalPrice * config.discountValue / 100
    : config.discountValue
  const finalPrice = Math.max(0, config.originalPrice - discount)
  return { ...config.toObject(), currentPrice: Number(finalPrice.toFixed(2)), discount: Number(discount.toFixed(2)), promotionActive }
}
