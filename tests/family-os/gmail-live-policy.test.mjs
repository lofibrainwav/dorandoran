import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertGoogleTokenServices,
  planBoundedGmailRead,
} from '../../lib/family-os/index.ts'

test('Calendar-only token cannot silently authorize Gmail', () => {
  assert.throws(
    () => assertGoogleTokenServices({ services: ['calendar'], scopes: ['https://www.googleapis.com/auth/calendar.readonly'] }, ['gmail']),
    /GOOGLE_TOKEN_SERVICE_MISSING:gmail/,
  )
})

test('Calendar plus Gmail read-only token passes Gmail gate', () => {
  assert.doesNotThrow(() => assertGoogleTokenServices({
    services: ['calendar', 'gmail'],
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  }, ['gmail']))
})

test('Gmail live read requires a bounded explicit query', () => {
  assert.throws(() => planBoundedGmailRead({ query: '', maxResults: 20 }), /GMAIL_QUERY_REQUIRED/)
  assert.throws(() => planBoundedGmailRead({ query: 'newer_than:14d', maxResults: 100 }), /GMAIL_MAX_RESULTS_OUT_OF_RANGE/)
})

test('bounded Gmail plan clamps no hidden defaults and preserves caller query', () => {
  assert.deepEqual(
    planBoundedGmailRead({ query: 'newer_than:7d label:inbox', maxResults: 25 }),
    { query: 'newer_than:7d label:inbox', maxResults: 25 },
  )
})
