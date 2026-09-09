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

// Unit 36 이 drive 를 실제 지원 서비스로 들였다. 이 테스트의 의도(미지원 서비스는 fail closed)는
// 그대로 두고 예시만 아직 지원하지 않는 서비스로 옮긴다 — 기대를 낮춘 것이 아니라 낡은 예시를 고친 것이다.
test('unknown Google source service fails closed', () => {
  assert.throws(() => resolveGoogleReadOnlyScopes(['calendar', 'photos']), /GOOGLE_SOURCE_SERVICE_UNSUPPORTED/)
})
