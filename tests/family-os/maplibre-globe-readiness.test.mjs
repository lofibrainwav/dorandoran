import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleGlobeProjection } from '../../lib/client/maplibre-globe.ts'

test('globe projection waits until the map style is loaded', () => {
  let listener
  const calls = []
  const map = {
    isStyleLoaded: () => false,
    once: (event, callback) => { assert.equal(event, 'style.load'); listener = callback },
    off: () => {},
    setProjection: (value) => calls.push(value),
  }
  scheduleGlobeProjection(map, () => assert.fail('unexpected projection error'))
  assert.deepEqual(calls, [])
  listener()
  assert.deepEqual(calls, [{ type: 'globe' }])
})

test('globe projection applies immediately when style is already loaded', () => {
  const calls = []
  const map = {
    isStyleLoaded: () => true,
    once: () => assert.fail('should not wait'),
    off: () => {},
    setProjection: (value) => calls.push(value),
  }
  scheduleGlobeProjection(map, () => assert.fail('unexpected projection error'))
  assert.deepEqual(calls, [{ type: 'globe' }])
})

test('projection failures degrade through the supplied error callback', () => {
  const expected = new Error('Style is not done loading.')
  let observed
  const map = {
    isStyleLoaded: () => true,
    once: () => {},
    off: () => {},
    setProjection: () => { throw expected },
  }
  scheduleGlobeProjection(map, (error) => { observed = error })
  assert.equal(observed, expected)
})