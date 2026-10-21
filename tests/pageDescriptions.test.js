import test from 'node:test'
import assert from 'node:assert/strict'
import { pageDescriptions } from '../src/data/pageDescriptions.js'

test('homepage metadata has a title and description for its default route', () => {
  const [title, description] = pageDescriptions['/']

  assert.equal(title, 'BrianE-Dev | Digital Technology & Developer Productivity')
  assert.match(description, /technology brand focused on digital solutions/)
})

test('all public page metadata entries are title and description pairs', () => {
  for (const [path, metadata] of Object.entries(pageDescriptions)) {
    assert.equal(typeof path, 'string')
    assert.equal(metadata.length, 2)
    assert.ok(metadata.every((value) => typeof value === 'string' && value.length > 0))
  }
})
