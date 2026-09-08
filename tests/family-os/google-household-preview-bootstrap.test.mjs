import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGoogleHouseholdPreviewEnv,
  parseGoogleOAuthClientSecret,
  parseGoogleOAuthRefreshToken,
} from '../../lib/server/google-household-preview-bootstrap.ts'

test('bootstrap extracts OAuth client credentials without exposing unrelated fields', () => {
  const parsed = parseGoogleOAuthClientSecret(JSON.stringify({
    installed: {
      client_id: 'calendar-client-id',
      client_secret: 'calendar-client-secret',
      redirect_uris: ['http://localhost'],
    },
  }))

  assert.deepEqual(parsed, {
    clientId: 'calendar-client-id',
    clientSecret: 'calendar-client-secret',
  })
})

test('bootstrap accepts web OAuth client credentials too', () => {
  const parsed = parseGoogleOAuthClientSecret(JSON.stringify({
    web: {
      client_id: 'web-client-id',
      client_secret: 'web-client-secret',
    },
  }))

  assert.deepEqual(parsed, {
    clientId: 'web-client-id',
    clientSecret: 'web-client-secret',
  })
})

test('bootstrap requires a refresh token and never returns access tokens', () => {
  assert.equal(parseGoogleOAuthRefreshToken(JSON.stringify({
    access_token: 'short-lived-access-token',
    refresh_token: 'stable-refresh-token',
    expiry_date: 123,
  })), 'stable-refresh-token')

  assert.throws(
    () => parseGoogleOAuthRefreshToken(JSON.stringify({ access_token: 'access-only' })),
    /MISSING_GOOGLE_REFRESH_TOKEN/,
  )
})

test('preview env plan contains only named runtime values and marks secrets sensitive', () => {
  const entries = buildGoogleHouseholdPreviewEnv({
    webClientId: 'login-client',
    authSecret: 'generated-auth-secret',
    membersJson: '[{"personId":"adult-a"}]',
    calendarClientId: 'calendar-client',
    calendarClientSecret: 'calendar-secret',
    calendarRefreshToken: 'refresh-secret',
    familyCalendarId: 'family-calendar',
    subjectRulesJson: '[{"kind":"series"}]',
    responsibilityOverridesJson: '',
  })

  assert.deepEqual(entries.map(({ key, sensitive }) => [key, sensitive]), [
    ['GOOGLE_WEB_CLIENT_ID', false],
    ['DORANDORAN_AUTH_SECRET', true],
    ['DORANDORAN_HOUSEHOLD_MEMBERS_JSON', true],
    ['GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID', false],
    ['GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET', true],
    ['GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN', true],
    ['DORANDORAN_FAMILY_CALENDAR_ID', true],
    ['DORANDORAN_CALENDAR_SUBJECT_RULES_JSON', true],
  ])
  assert.equal(entries.some((entry) => entry.value === ''), false)
})
