export function getPromotionDateRange(startDate, endDate) {
  if (!startDate || !endDate) return null
  const hasValidCalendarDate = (value) => {
    if (value instanceof Date) return Number.isFinite(value.getTime())
    if (typeof value !== 'string') return false
    const datePart = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!datePart) return false
    const parsedDate = new Date(`${datePart[1]}T00:00:00.000Z`)
    return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === datePart[1]
  }
  if (!hasValidCalendarDate(startDate) || !hasValidCalendarDate(endDate)) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return null
  const format = (date) => date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  return { start: format(start), end: format(end) }
}

export function dateInputToUtcBoundary(value, isEndDate = false) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const day = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) return null
  const date = new Date(`${value}T${isEndDate ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function dateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}
