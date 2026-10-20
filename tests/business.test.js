import assert from 'node:assert/strict'
import test from 'node:test'
import { BusinessContact, BusinessCounter, BusinessRequest } from '../backend/src/models/index.js'
import { nextReference, saveBusinessRequest } from '../backend/src/services/business.js'

test('atomic sequence produces unique, stable formatted business references under concurrency', async () => {
  const originals = { counter: BusinessCounter.findOneAndUpdate, create: BusinessRequest.create, contact: BusinessContact.findOneAndUpdate }
  const counters = new Map()
  const references = new Set()
  try {
    BusinessCounter.findOneAndUpdate = async ({ key }) => {
      const value = (counters.get(key) || 0) + 1
      counters.set(key, value)
      return { value }
    }
    BusinessRequest.create = async ({ reference }) => {
      assert.equal(references.has(reference), false)
      references.add(reference)
      return { reference }
    }
    BusinessContact.findOneAndUpdate = async () => ({})

    const [enquiries, quotes] = await Promise.all([
      Promise.all(Array.from({ length: 40 }, () => nextReference('enquiry'))),
      Promise.all(Array.from({ length: 40 }, () => nextReference('quote'))),
    ])
    assert.equal(new Set([...enquiries, ...quotes]).size, 80)
    assert.match(enquiries[0], /^BD-ENQ-\d{4}-\d{6}$/)
    assert.match(quotes[0], /^BD-QUO-\d{4}-\d{6}$/)

    const saved = await saveBusinessRequest('enquiry', { name: 'Ada Example', email: 'ada@example.test' })
    assert.match(saved.reference, /^BD-ENQ-\d{4}-\d{6}$/)
    assert.equal(references.has(saved.reference), true)
  } finally {
    BusinessCounter.findOneAndUpdate = originals.counter
    BusinessRequest.create = originals.create
    BusinessContact.findOneAndUpdate = originals.contact
  }
})
