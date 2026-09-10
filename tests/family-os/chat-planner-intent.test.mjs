import assert from 'node:assert/strict'
import test from 'node:test'
import { appendPlannerChatProposal, isPlannerSchedulingRequest } from '../../lib/family-os/chat-planner-intent.ts'

test('only explicit conversational scheduling requests enter Planner proposal flow', () => {
  assert.equal(isPlannerSchedulingRequest('이번 주 일정 확인해줘'), false)
  assert.equal(isPlannerSchedulingRequest('산책 30분 시간표에 넣어줘'), true)
  assert.equal(isPlannerSchedulingRequest('내일 스케줄 잡아줘'), true)
  assert.equal(isPlannerSchedulingRequest('오늘 다음 일정이 뭐야?'), false)
  assert.equal(isPlannerSchedulingRequest('시간표에 뭐가 있어?'), false)
})

test('chat Planner proposal preserves memo lines and is idempotent', () => {
  assert.equal(
    appendPlannerChatProposal('학교 준비 20분\n', '산책 30분 시간표에 넣어줘'),
    '학교 준비 20분\n산책 30분 시간표에 넣어줘',
  )
  assert.equal(
    appendPlannerChatProposal('산책 30분 시간표에 넣어줘', '산책 30분 시간표에 넣어줘'),
    '산책 30분 시간표에 넣어줘',
  )
})
