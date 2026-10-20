import test from 'node:test'
import assert from 'node:assert/strict'
import { getPromotionDateRange, dateInputToUtcBoundary, dateInputValue } from '../src/utils/promotionDates.js'
import { getFinalPrice } from '../backend/src/utils/pricing.js'

test('promotion date range is hidden unless both valid ordered dates are configured', () => {
  assert.equal(getPromotionDateRange(null, null), null)
  assert.equal(getPromotionDateRange('2026-10-25T00:00:00.000Z', null), null)
  assert.equal(getPromotionDateRange(null, '2026-11-05T23:59:59.999Z'), null)
  assert.equal(getPromotionDateRange('invalid', '2026-11-05T23:59:59.999Z'), null)
  assert.equal(getPromotionDateRange('2026-02-30T00:00:00.000Z', '2026-11-05T23:59:59.999Z'), null)
  assert.equal(getPromotionDateRange('2026-11-06T00:00:00.000Z', '2026-11-05T23:59:59.999Z'), null)
})

test('valid promotion dates render without UTC calendar-day shifts', () => {
  const range = getPromotionDateRange('2026-10-25T00:00:00.000Z', '2026-11-05T23:59:59.999Z')
  assert.equal(range.start, new Date('2026-10-25T00:00:00.000Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }))
  assert.equal(range.end, new Date('2026-11-05T00:00:00.000Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }))
})

test('admin date-only values map to stable UTC day boundaries and reload unchanged', () => {
  assert.equal(dateInputToUtcBoundary('2026-10-25'), '2026-10-25T00:00:00.000Z')
  assert.equal(dateInputToUtcBoundary('2026-11-05', true), '2026-11-05T23:59:59.999Z')
  assert.equal(dateInputToUtcBoundary('2026-02-30'), null)
  assert.equal(dateInputValue('2026-10-25T00:00:00.000Z'), '2026-10-25')
  assert.equal(dateInputValue(''), '')
})

test('configured dates display before promotion activation without enabling the discount', () => {
  const config = {
    active: true, discountEnabled: true, startDate: new Date('2026-10-25T00:00:00.000Z'),
    endDate: new Date('2026-11-05T23:59:59.999Z'), originalPrice: 100, discountType: 'percentage', discountValue: 20,
    toObject() { return { ...this } },
  }
  const before = getFinalPrice(config, new Date('2026-10-24T23:59:59.999Z'))
  const during = getFinalPrice(config, new Date('2026-10-25T00:00:00.000Z'))
  const after = getFinalPrice(config, new Date('2026-11-06T00:00:00.000Z'))
  assert.equal(before.promotionActive, false)
  assert.equal(before.currentPrice, 100)
  assert.equal(during.promotionActive, true)
  assert.equal(during.currentPrice, 80)
  assert.equal(after.promotionActive, false)
  assert.equal(after.currentPrice, 100)
})
