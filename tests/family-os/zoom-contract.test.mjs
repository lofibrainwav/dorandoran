import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disclosureForZoom,
  makeZoomState,
  zoomTowardPerson,
  YEONG_TIME_AXIS,
} from '../../lib/family-os/index.ts'

test('today local family zoom exposes operational 6W1H fields without provider assumptions', () => {
  const state = makeZoomState({ time: 'today', space: 'local', focus: 'family' })
  assert.deepEqual(disclosureForZoom(state), ['who', 'what', 'when', 'where'])
})

test('macro past zoom keeps place and time prominent for journey projection', () => {
  const state = makeZoomState({ time: 'past', space: 'world', focus: 'family' })
  assert.deepEqual(disclosureForZoom(state), ['what', 'when', 'where'])
})

test('person zoom takes an id rather than branching on a person name', () => {
  const state = zoomTowardPerson(makeZoomState({ time: 'today', space: 'local', focus: 'family' }), 'person-42')
  assert.equal(state.focus, 'person')
  assert.equal(state.focusRef, 'person-42')
  assert.equal(state.time, 'today')
})


test('Yeong axis is left-to-right from Past toward Now', () => {
  assert.deepEqual(YEONG_TIME_AXIS, ['past', 'year', 'month', 'week', 'today', 'now'])
})
