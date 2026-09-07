import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocalCalendarRuntimeConfig, weekWindowFromLocalDate } from '../../lib/family-os/index.ts'

test('missing local live config falls back instead of inventing credentials', () => {
  assert.equal(resolveLocalCalendarRuntimeConfig({}), null)
})

test('complete local live config resolves without exposing secret contents', () => {
  const config = resolveLocalCalendarRuntimeConfig({
    GOOGLE_CALENDAR_CLIENT_SECRET_PATH: '/private/client.json',
    GOOGLE_CALENDAR_TOKEN_PATH: '/private/token.json',
    GOOGLE_CALENDAR_TARGET_ID: 'family-calendar',
  })
  assert.deepEqual(config, {
    clientPath: '/private/client.json',
    tokenPath: '/private/token.json',
    calendarId: 'family-calendar',
  })
})
test('family week ends at next Sunday boundary, not eight days later', () => {
  const window = weekWindowFromLocalDate(new Date('2026-09-09T12:00:00-07:00'), 'America/Los_Angeles')
  assert.equal(window.weekStartDate, '2026-09-06')
  assert.equal(window.start.toISOString(), '2026-09-06T07:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-09-13T07:00:00.000Z')
  assert.equal((window.end.getTime() - window.start.getTime()) / 86400000, 7)
})
