import test from 'node:test'
import assert from 'node:assert/strict'

import { decideHouseholdAccess, PUBLIC_ACCESS_PATHS } from '../../lib/server/household-access-decision.ts'

const adult = { personId: 'adult-a', googleSub: '1', access: 'adult', roles: ['admin'], canSignIn: true }

test('incomplete Google identity configuration fails closed, there is no other door', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: false, membership: [adult], sessionMember: adult }), { kind: 'unavailable' })
})

test('unparsable or empty membership fails closed even with complete configuration', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: null, sessionMember: null }), { kind: 'unavailable' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [], sessionMember: null }), { kind: 'unavailable' })
})

test('valid session passes; no session redirects to /signin; public paths always pass', () => {
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [adult], sessionMember: adult }), { kind: 'next' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/family', googleComplete: true, membership: [adult], sessionMember: null }), { kind: 'redirect', to: '/signin', status: 307 })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/signin', googleComplete: false, membership: null, sessionMember: null }), { kind: 'next' })
  assert.deepEqual(decideHouseholdAccess({ pathname: '/unlock', googleComplete: true, membership: [adult], sessionMember: null }), { kind: 'redirect', to: '/signin', status: 307 })
})

// 2026-09-09 형 결재: "/ 공개 안 해". 이전까지 홈이 게이트 뒤에 있는 것은 25H 의 "그 외 전부"
// 에서 딸려온 결과였을 뿐 어디에도 결정으로 적혀 있지 않았다 — 이 테스트가 그 결정이다.
test('홈은 공개가 아니다 — 로그인 없이는 / 도 /signin 으로 간다', () => {
  assert.deepEqual(
    decideHouseholdAccess({ pathname: '/', googleComplete: true, membership: [adult], sessionMember: null }),
    { kind: 'redirect', to: '/signin', status: 307 },
  )
  assert.deepEqual(
    decideHouseholdAccess({ pathname: '/', googleComplete: true, membership: [adult], sessionMember: adult }),
    { kind: 'next' },
  )
})

test('공개 경로는 로그인 문 두 개뿐이다', () => {
  // 이 집합이 늘어나면 가족의 사적 공간이 그만큼 열린다. 늘리는 것은 결재 사항이지
  // 리팩터링의 부수 효과가 아니다.
  assert.deepEqual([...PUBLIC_ACCESS_PATHS].sort(), ['/api/auth/google', '/signin'])
})
