import test from 'node:test'
import assert from 'node:assert/strict'

import { nextMapReadiness } from '../../lib/client/map-readiness.ts'

// 2026-09-09 진단에서 나왔다. 자동화 탭에서 지도가 비어 있길래 고장난 줄 알았는데,
// 실측하니 그 탭은 document.visibilityState='hidden' 이라 requestAnimationFrame 이
// 1초에 0프레임이었다. MapLibre 는 rAF 로 그린다 — 못 그리는 브라우저가 아니라
// 그릴 기회를 못 받은 문서였다. 그런데 같은 코드가 실제 사용자에게도 똑같이 말한다:
// 배경 탭으로 열어두면 12초 뒤 "이 브라우저에서 지도를 표시하지 못했어요" 가 뜨고,
// 나중에 탭을 앞으로 가져와 실제로 그려져도 영원히 복구되지 않는다.

test('그려졌다는 사실이 무엇보다 세다 — 실패로 표시된 뒤에도 복구된다', () => {
  // 지도가 실제로 렌더된 뒤에도 "이 브라우저는 지도를 못 띄운다" 고 말하는 것은 거짓이다.
  assert.equal(nextMapReadiness('unavailable', 'load', false), 'ready')
  assert.equal(nextMapReadiness('loading', 'load', false), 'ready')
  assert.equal(nextMapReadiness('ready', 'load', false), 'ready')
})

test('문서가 숨어 있는 동안의 타임아웃은 판정이 아니다', () => {
  // 숨은 문서는 rAF 를 받지 못한다. 안 그려진 것과 못 그리는 것은 다르다.
  assert.equal(nextMapReadiness('loading', 'timeout', true), 'loading')
})

test('보이는 문서에서 시간이 다 되면 실패로 본다', () => {
  // 보이는데도 못 그렸다면 그것은 진짜 관측이다.
  assert.equal(nextMapReadiness('loading', 'timeout', false), 'unavailable')
})

test('이미 준비된 지도는 타임아웃으로 강등되지 않는다', () => {
  assert.equal(nextMapReadiness('ready', 'timeout', false), 'ready')
  assert.equal(nextMapReadiness('ready', 'timeout', true), 'ready')
})

test('지도 자신이 낸 오류는 숨김 여부와 무관하게 실패다', () => {
  // error 는 관측이지 시간 초과가 아니다.
  assert.equal(nextMapReadiness('loading', 'error', true), 'unavailable')
  assert.equal(nextMapReadiness('loading', 'error', false), 'unavailable')
  assert.equal(nextMapReadiness('ready', 'error', false), 'unavailable')
})
