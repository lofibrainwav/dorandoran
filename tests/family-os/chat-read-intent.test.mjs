import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeterministicChatReadRequest } from '../../lib/family-os/chat-read-intent.ts'

test('known calendar and lifecycle read questions stay on the deterministic model', () => {
  assert.equal(isDeterministicChatReadRequest('이번 주 일정 확인해줘'), true)
  assert.equal(isDeterministicChatReadRequest('승인 대기 후보 보여줘'), true)
  assert.equal(isDeterministicChatReadRequest('오늘 할 일 알려줘'), true)
})

test('open-ended chat remains eligible for the AI path', () => {
  assert.equal(isDeterministicChatReadRequest('가족 운영을 더 따뜻하게 설명해줘'), false)
})
