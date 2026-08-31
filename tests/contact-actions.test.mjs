import assert from 'node:assert/strict'
import test from 'node:test'
import { copyValue, shareValue } from '../src/contact-actions.mjs'

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

test('uses native share with the fixed card data', async () => {
  const shared = []
  const data = {
    title: 'Profile card',
    text: 'Connect',
    url: 'https://example.test/me/',
  }
  const result = await shareValue(data, {
    share: async (payload) => shared.push(payload),
    writeText: async () => assert.fail('clipboard should not run'),
  })
  assert.equal(result, 'shared')
  assert.deepEqual(shared, [data])
})

test('treats a cancelled native share as an intentional abort', async () => {
  const result = await shareValue(
    { url: 'https://example.test/me/' },
    {
      share: async () => {
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      },
      writeText: async () => assert.fail('clipboard should not run'),
    },
  )
  assert.equal(result, 'aborted')
})

test('falls back from unavailable sharing to copy, reveal, and selection', async () => {
  let revealed = false
  let selected = false
  const result = await shareValue(
    { url: 'https://example.test/me/' },
    {
      writeText: async () => {
        throw new Error('denied')
      },
      revealFallback: () => {
        revealed = true
      },
      selectFallback: () => {
        selected = true
      },
    },
  )
  assert.equal(result, 'selected')
  assert.equal(revealed, true)
  assert.equal(selected, true)
})
