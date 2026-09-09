/**
 * Unit 44 — loopback OAuth 콜백 판정.
 *
 * `scripts/google-auth-mint.mjs` 가 여는 로컬 서버는 그 포트로 오는 **아무 요청이나** 받는다.
 * 브라우저에 열려 있는 다른 페이지가 `http://localhost:<port>/oauth2callback?code=<공격자코드>`
 * 를 부르면, 검사가 없는 도구는 공격자 계정의 authorization code 를 교환해
 * **공격자의 refresh token 을 주인의 파일에 써 넣는다.** loopback OAuth 의 알려진 CSRF 이고
 * 표준 방어가 `state` nonce 다.
 *
 * 판정만 하는 순수 함수로 떼어낸 이유: 이 결정이 이 도구에서 유일하게 보안을 지는 부분인데,
 * 실제 OAuth 왕복 안에 묻어두면 테스트할 수 없다.
 */

import path from 'node:path'

export type GoogleAuthCallbackRejectReason =
  | 'state_missing'
  | 'state_mismatch'
  | 'provider_error'
  | 'code_missing'

export type GoogleAuthCallbackDecision =
  | { kind: 'ignore' }
  | { kind: 'reject'; reason: GoogleAuthCallbackRejectReason }
  | { kind: 'code'; code: string }

export function decideGoogleAuthCallback(input: {
  /** `req.url` 그대로. 경로와 쿼리만 쓰므로 origin 은 의미 없다. */
  url: string
  expectedPath: string
  expectedState: string
}): GoogleAuthCallbackDecision {
  const expectedState = typeof input.expectedState === 'string' ? input.expectedState.trim() : ''
  // 빈 state 를 허용하면 "state 없음" 요청이 "state 일치" 로 읽혀 이 유닛이 통째로 무력해진다.
  // 그것은 입력의 문제가 아니라 호출자가 nonce 를 만들지 않은 것이다.
  if (expectedState === '') throw new Error('GOOGLE_AUTH_STATE_REQUIRED')

  const requested = new URL(input.url || '/', 'http://localhost')
  // 브라우저는 favicon 같은 것을 같은 포트로 함께 요청한다. 그것은 실패가 아니라 우리 콜백이 아니다.
  if (requested.pathname !== input.expectedPath) return { kind: 'ignore' }

  const state = requested.searchParams.get('state')?.trim() ?? ''
  if (state === '') return { kind: 'reject', reason: 'state_missing' }
  // provider error 보다 먼저 본다. 아니면 state 를 모르는 상대가 `?error=` 하나로
  // 주인의 인증 흐름을 끊을 수 있다.
  //
  // 단순 비교로 충분하다: nonce 는 우리가 만든 256비트 난수이고 채널은 loopback 이다.
  // 값을 못 읽는 상대가 로컬 소켓 타이밍으로 그것을 알아내는 경로는 없다.
  if (state !== expectedState) return { kind: 'reject', reason: 'state_mismatch' }

  if (requested.searchParams.has('error')) return { kind: 'reject', reason: 'provider_error' }

  const code = requested.searchParams.get('code')?.trim() ?? ''
  if (code === '') return { kind: 'reject', reason: 'code_missing' }
  return { kind: 'code', code }
}

/**
 * 이 도구의 출력물은 **전체가 자격증명**이다. 추적되는 경로에 쓰게 두면
 * `git add -A` 한 번으로 refresh token 이 공개 저장소에 올라간다.
 *
 * 그래서 저장소 안에는 최상위 `.env*` 만 허용한다 — `.gitignore` 가 이미 덮는 이름이다.
 * 저장소 밖은 주인이 고른 곳이므로 판단하지 않는다.
 *
 * `.gitignore` 의 `.env*` 가 하위 디렉터리에서도 매칭된다는 해석에는 기대지 않는다.
 * 확실한 것만 허용하는 편이, 맞을 수도 있는 것을 허용하는 편보다 낫다.
 */
export function assertSecretOutPath(input: { outPath: string; repoRoot: string }): string {
  const relative = path.relative(path.resolve(input.repoRoot), path.resolve(input.outPath))
  const insideRepo = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  if (!insideRepo) return input.outPath
  if (path.dirname(relative) === '.' && path.basename(relative).startsWith('.env')) return input.outPath
  throw new Error(`SECRET_OUT_PATH_TRACKABLE:${relative}`)
}
