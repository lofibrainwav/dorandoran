import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveGoogleCalendarWebRuntimeConfig,
  calendarWebRuntimeHealth,
  buildGoogleCalendarEvent,
} from '../../lib/server/google-calendar-web-transport.ts'

test('web Calendar runtime resolves only a complete server-side OAuth credential set', () => {
  const config = resolveGoogleCalendarWebRuntimeConfig({
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID: 'client-id',
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET: 'client-secret',
    GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN: 'refresh-token',
    DORANDORAN_FAMILY_CALENDAR_ID: 'calendar-id',
  })
  assert.deepEqual(config, {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token',
    calendarId: 'calendar-id',
  })
  assert.equal(calendarWebRuntimeHealth({
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID: 'client-id',
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET: 'client-secret',
    GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN: 'refresh-token',
    DORANDORAN_FAMILY_CALENDAR_ID: 'calendar-id',
  }), 'ready')
})

test('web Calendar runtime is off when no credential input exists', () => {
  assert.equal(resolveGoogleCalendarWebRuntimeConfig({}), null)
  assert.equal(calendarWebRuntimeHealth({}), 'off')
})

test('partial web Calendar credentials fail closed rather than falling through', () => {
  const env = {
    GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID: 'client-id',
    DORANDORAN_FAMILY_CALENDAR_ID: 'calendar-id',
  }
  assert.throws(() => resolveGoogleCalendarWebRuntimeConfig(env), /INCOMPLETE_GOOGLE_CALENDAR_WEB_CONFIG/)
  assert.equal(calendarWebRuntimeHealth(env), 'incomplete')
})

test('web Calendar config does not accept browser login client alone as Calendar authorization', () => {
  const env = {
    GOOGLE_WEB_CLIENT_ID: 'browser-login-client',
    DORANDORAN_FAMILY_CALENDAR_ID: 'calendar-id',
  }
  assert.equal(resolveGoogleCalendarWebRuntimeConfig(env), null)
  assert.equal(calendarWebRuntimeHealth(env), 'off')
})

test('Calendar write payload is local-timezone aware and idempotency-keyed', () => {
  assert.deepEqual(buildGoogleCalendarEvent({
    id: 'draft-wish-2026-09-11-600', title: '산책 30분', date: '2026-09-11', startMinute: 600, minutes: 30, owner: '함께', timeZone: 'America/Los_Angeles',
  }), {
    summary: '산책 30분',
    description: '함께 · Family OS에서 승인한 계획',
    start: { dateTime: '20260911T100000', timeZone: 'America/Los_Angeles' },
    end: { dateTime: '20260911T103000', timeZone: 'America/Los_Angeles' },
    extendedProperties: { private: { dorandoranPlanId: 'draft-wish-2026-09-11-600' } },
  })
})

test('Calendar write payload rejects invalid ranges and unsafe timezone values', () => {
  assert.throws(() => buildGoogleCalendarEvent({ id: 'draft', title: 'x', date: '2026-09-11', startMinute: 1430, minutes: 31, owner: '함께', timeZone: 'America/Los_Angeles' }), /INVALID_CALENDAR_TIMEBOX_DURATION/)
  assert.throws(() => buildGoogleCalendarEvent({ id: 'draft', title: 'x', date: '2026-09-11', startMinute: 600, minutes: 30, owner: '함께', timeZone: 'America/Los_Angeles;evil' }), /INVALID_TIME_ZONE/)
})
