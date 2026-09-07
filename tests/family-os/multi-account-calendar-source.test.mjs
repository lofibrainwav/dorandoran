import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveLocalCalendarSourceRegistry,
  calendarSourceHealth,
} from '../../lib/family-os/index.ts'

test('multi-account registry keeps token paths and calendar ids isolated', () => {
  const registry = resolveLocalCalendarSourceRegistry({
    GOOGLE_CALENDAR_SOURCE_KEYS: 'family,jayden',
    GOOGLE_CALENDAR_SOURCE_FAMILY_CLIENT_SECRET_PATH: '/private/client.json',
    GOOGLE_CALENDAR_SOURCE_FAMILY_TOKEN_PATH: '/private/family-token.json',
    GOOGLE_CALENDAR_SOURCE_FAMILY_TARGET_ID: 'family-calendar',
    GOOGLE_CALENDAR_SOURCE_JAYDEN_CLIENT_SECRET_PATH: '/private/client.json',
    GOOGLE_CALENDAR_SOURCE_JAYDEN_TOKEN_PATH: '/private/jayden-token.json',
    GOOGLE_CALENDAR_SOURCE_JAYDEN_TARGET_ID: 'primary',
  })

  assert.equal(registry.sources.length, 2)
  assert.notEqual(registry.sources[0].tokenPath, registry.sources[1].tokenPath)
  assert.deepEqual(registry.incompleteSourceKeys, [])
})
test('incomplete source is reported instead of silently invented', () => {
  const registry = resolveLocalCalendarSourceRegistry({
    GOOGLE_CALENDAR_SOURCE_KEYS: 'family,jayden',
    GOOGLE_CALENDAR_SOURCE_FAMILY_CLIENT_SECRET_PATH: '/private/client.json',
    GOOGLE_CALENDAR_SOURCE_FAMILY_TOKEN_PATH: '/private/family-token.json',
    GOOGLE_CALENDAR_SOURCE_FAMILY_TARGET_ID: 'family-calendar',
  })
  assert.equal(registry.sources.length, 1)
  assert.deepEqual(registry.incompleteSourceKeys, ['jayden'])
})

test('source health distinguishes GREEN, PARTIAL, and FAILURE', () => {
  assert.equal(calendarSourceHealth(2, 2, 0), 'green')
  assert.equal(calendarSourceHealth(2, 1, 1), 'partial')
  assert.equal(calendarSourceHealth(2, 0, 2), 'failure')
})