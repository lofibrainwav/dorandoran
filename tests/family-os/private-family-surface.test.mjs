import test from 'node:test'
import assert from 'node:assert/strict'
import { privateFamilySurfaceEnabled } from '../../lib/server/private-family-surface.ts'

test('private Family surface is disabled by default', () => {
  assert.equal(privateFamilySurfaceEnabled({}), false)
})

test('private Family surface requires explicit local opt-in', () => {
  assert.equal(privateFamilySurfaceEnabled({ CHAD_PRIVATE_LOCAL_UI: '1' }), true)
  assert.equal(privateFamilySurfaceEnabled({ CHAD_PRIVATE_LOCAL_UI: 'true' }), false)
})

test('private Family surface never enables on Vercel', () => {
  assert.equal(privateFamilySurfaceEnabled({ CHAD_PRIVATE_LOCAL_UI: '1', VERCEL: '1' }), false)
})
