import test from 'node:test'
import assert from 'node:assert/strict'

import { cameraForTimeScale, resolveHouseholdHome } from '../../lib/family-os/index.ts'

test('household home defaults to Los Angeles when unset', () => {
  assert.deepEqual(resolveHouseholdHome({}), { label: 'Los Angeles', latitude: 34.05, longitude: -118.24 })
})

test('household home reads "lat,lng" plus a label and rejects out-of-range or malformed values', () => {
  assert.deepEqual(resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: '37.5665, 126.978', DORANDORAN_HOME_LABEL: 'Seoul' }), {
    label: 'Seoul', latitude: 37.5665, longitude: 126.978,
  })
  assert.equal(resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: '37.5665,126.978' }).label, 'Home')
  assert.throws(() => resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: '91,0' }), /INVALID_HOUSEHOLD_HOME/)
  assert.throws(() => resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: '10,181' }), /INVALID_HOUSEHOLD_HOME/)
  assert.throws(() => resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: 'north,west' }), /INVALID_HOUSEHOLD_HOME/)
  assert.throws(() => resolveHouseholdHome({ DORANDORAN_HOME_COORDINATES: '37.5' }), /INVALID_HOUSEHOLD_HOME/)
  // A label alone must not quietly relabel the default coordinates.
  assert.throws(() => resolveHouseholdHome({ DORANDORAN_HOME_LABEL: 'Seoul' }), /INVALID_HOUSEHOLD_HOME/)
})

test('near time scales centre on home, past stays a world view, zoom tightens toward now', () => {
  const home = { label: 'Seoul', latitude: 37.5665, longitude: 126.978 }
  const now = cameraForTimeScale('now', home)
  const week = cameraForTimeScale('week', home)
  const year = cameraForTimeScale('year', home)
  const past = cameraForTimeScale('past', home)
  assert.deepEqual(now.center, [126.978, 37.5665])
  assert.deepEqual(week.center, [126.978, 37.5665])
  assert.deepEqual(year.center, [126.978, 37.5665])
  assert.ok(now.zoom > cameraForTimeScale('today', home).zoom && cameraForTimeScale('today', home).zoom > week.zoom)
  assert.ok(week.zoom > cameraForTimeScale('month', home).zoom && cameraForTimeScale('month', home).zoom > year.zoom)
  assert.deepEqual(past, { center: [0, 22], zoom: 1.25 })
})
