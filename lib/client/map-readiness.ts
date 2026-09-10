/**
 * Unit 46 — 지도 준비 상태 판정.
 *
 * 2026-09-09 진단에서 나왔다. 자동화 탭에서 지도가 비어 있어 고장난 줄 알았는데, 실측하니
 * 그 문서는 `visibilityState: 'hidden'` 이라 `requestAnimationFrame` 이 1초에 0프레임이었다.
 * MapLibre 는 rAF 로 그린다. 즉 **못 그리는 브라우저가 아니라 그릴 기회를 못 받은 문서**였다.
 *
 * 같은 코드가 실제 가족에게도 똑같이 말한다: 배경 탭으로 열어두면 12초가 지나 "이 브라우저에서
 * 지도를 표시하지 못했어요" 가 뜨고, 나중에 탭을 앞으로 가져와 지도가 실제로 그려져도
 * 복구되지 않았다 — 첫 판정이 종착이었기 때문이다.
 *
 * 시간 초과는 관측이 아니다. "아직 안 그려졌다" 를 "이 브라우저는 못 한다" 로 바꾸는 순간
 * 그 화면은 거짓을 말한다.
 */

export type MapReadiness = 'loading' | 'ready' | 'unavailable'

export type MapReadinessEvent =
  /** 지도가 실제로 첫 렌더를 마쳤다. */
  | 'load'
  /** 지도가 스스로 오류를 냈다. */
  | 'error'
  /** 기다리기로 한 시간이 지났다. */
  | 'timeout'

export function nextMapReadiness(
  current: MapReadiness,
  event: MapReadinessEvent,
  documentHidden: boolean,
): MapReadiness {
  // 그려졌다는 사실이 무엇보다 세다. 실패로 표시된 뒤라도, 실제로 렌더된 지도를
  // "표시하지 못했다" 고 계속 말하는 것은 화면이 거짓을 말하는 것이다.
  if (event === 'load') return 'ready'

  // 지도 자신이 낸 오류는 진짜 관측이다 — 시간이 아니라 사건이므로 숨김 여부와 무관하다.
  if (event === 'error') return 'unavailable'

  // 이미 그려진 지도는 시간이 지났다고 강등되지 않는다.
  if (current === 'ready') return 'ready'
  // 숨은 문서는 rAF 를 받지 못한다. 여기서의 시간 초과는 브라우저의 무능이 아니라
  // 우리가 아직 아무것도 보지 못했다는 뜻이다. 계속 기다린다.
  if (documentHidden) return current
  return 'unavailable'
}
