import assert from 'node:assert/strict'
import test from 'node:test'
import { copyValue } from '../src/contact-actions.mjs'

test('copies the exact Discord username and reports success', async () => {
  const writes = []
  const result = await copyValue('sample_user', {
    writeText: async (value) => writes.push(value),
    selectFallback: () => assert.fail('fallback should not run'),
  })
  assert.equal(result, 'copied')
  assert.deepEqual(writes, ['sample_user'])
})

test('selects the exact visible username when clipboard writing fails', async () => {
  let selected = false
  const result = await copyValue('sample_user', {
    writeText: async () => {
      throw new Error('denied')
    },
    selectFallback: () => {
      selected = true
    },
  })
  assert.equal(result, 'selected')
  assert.equal(selected, true)
})
