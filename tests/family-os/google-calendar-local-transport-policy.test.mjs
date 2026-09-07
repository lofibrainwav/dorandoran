import test from 'node:test'
import assert from 'node:assert/strict'
import { assertGoogleCalendarPageComplete } from '../../lib/server/google-calendar-local-transport.ts'

test('bounded Google Calendar read fails closed when another page exists', () => {
  assert.throws(
    () => assertGoogleCalendarPageComplete('next-page-token'),
    /GOOGLE_CALENDAR_RANGE_TRUNCATED/,
  )
})

test('bounded Google Calendar read accepts a complete page', () => {
  assert.doesNotThrow(() => assertGoogleCalendarPageComplete(undefined))
  assert.doesNotThrow(() => assertGoogleCalendarPageComplete(''))
})
