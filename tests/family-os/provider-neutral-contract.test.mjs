import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = [
  new URL('../../lib/family-os/universal-context.ts', import.meta.url),
  new URL('../../lib/family-os/zoom-contract.ts', import.meta.url),
]

test('new universal contracts contain no family-member or ecosystem provider names', async () => {
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  for (const forbidden of ['Jayden', 'Julie', 'Google', 'Apple']) {
    assert.equal(source.includes(forbidden), false, `universal core must not hardcode ${forbidden}`)
  }
})
