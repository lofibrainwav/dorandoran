import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveGoogleReadOnlyScopes } from '../../lib/family-os/index.ts'

test('calendar only requests calendar readonly', () => {
  assert.deepEqual(resolveGoogleReadOnlyScopes(['calendar']), [
    'https://www.googleapis.com/auth/calendar.readonly',
  ])
})

test('calendar plus gmail uses one deduplicated readonly scope set', () => {
  assert.deepEqual(resolveGoogleReadOnlyScopes(['calendar', 'gmail', 'calendar']), [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
  ])
})

test('unknown Google source service fails closed', () => {
  assert.throws(() => resolveGoogleReadOnlyScopes(['calendar', 'drive']), /GOOGLE_SOURCE_SERVICE_UNSUPPORTED/)
})
