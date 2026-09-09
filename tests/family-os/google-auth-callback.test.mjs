import test from 'node:test'
import assert from 'node:assert/strict'

import { decideGoogleAuthCallback, assertSecretOutPath } from '../../lib/server/google-auth-callback.ts'

const STATE = 'a'.repeat(43)
const PATH = '/oauth2callback'

function decide(url, overrides = {}) {
  return decideGoogleAuthCallback({ url, expectedPath: PATH, expectedState: STATE, ...overrides })
}

// ---- 성공 경로 ----

test('맞는 state 와 code 가 오면 code 를 돌려준다', () => {
  assert.deepEqual(decide(`${PATH}?state=${STATE}&code=auth-code-1`), { kind: 'code', code: 'auth-code-1' })
})

test('쿼리 순서와 부가 파라미터는 판정을 바꾸지 않는다', () => {
  assert.deepEqual(
    decide(`${PATH}?code=auth-code-1&scope=https%3A//x&state=${STATE}&authuser=0`),
    { kind: 'code', code: 'auth-code-1' },
  )
})

// ---- 우리 콜백이 아닌 것 ----

test('다른 경로는 거부가 아니라 무시다', () => {
  // 브라우저는 favicon 등을 같은 포트로 함께 요청한다. 그것을 실패로 셈하면
  // 정상 흐름이 자기 브라우저 때문에 죽는다.
  assert.deepEqual(decide('/favicon.ico'), { kind: 'ignore' })
  assert.deepEqual(decide('/'), { kind: 'ignore' })
})

// ---- CSRF: 이 유닛이 존재하는 이유 ----

test('state 가 없으면 거부한다 — 우리가 시작한 흐름이라는 증거가 없다', () => {
  // loopback 서버는 그 포트로 오는 아무 요청이나 받는다. 열려 있는 웹페이지가
  // localhost:<port>/oauth2callback?code=<공격자코드> 를 부르면, state 검사가 없는 도구는
  // 공격자 계정의 refresh token 을 주인의 파일에 써 넣는다.
  assert.deepEqual(decide(`${PATH}?code=attacker-code`), { kind: 'reject', reason: 'state_missing' })
})

test('state 가 다르면 거부한다', () => {
  assert.deepEqual(
    decide(`${PATH}?state=${'b'.repeat(43)}&code=attacker-code`),
    { kind: 'reject', reason: 'state_mismatch' },
  )
})

test('state 는 provider error 보다 먼저 확인한다', () => {
  // 아니면 state 를 모르는 상대가 ?error= 하나로 주인의 인증 흐름을 끊을 수 있다.
  assert.deepEqual(
    decide(`${PATH}?error=access_denied`),
    { kind: 'reject', reason: 'state_missing' },
  )
})

// ---- provider 가 거절했을 때 ----

test('state 가 맞고 provider 가 거절했으면 그 사실로 거부한다', () => {
  assert.deepEqual(
    decide(`${PATH}?state=${STATE}&error=access_denied`),
    { kind: 'reject', reason: 'provider_error' },
  )
})

test('state 는 맞는데 code 가 없으면 거부한다', () => {
  assert.deepEqual(decide(`${PATH}?state=${STATE}`), { kind: 'reject', reason: 'code_missing' })
  assert.deepEqual(decide(`${PATH}?state=${STATE}&code=`), { kind: 'reject', reason: 'code_missing' })
  assert.deepEqual(decide(`${PATH}?state=${STATE}&code=%20%20`), { kind: 'reject', reason: 'code_missing' })
})

// ---- 호출자의 실수는 조용히 통과시키지 않는다 ----

test('expectedState 가 비어 있으면 던진다 — nonce 를 만들지 않은 것은 프로그래밍 오류다', () => {
  // 빈 state 를 허용하면 "state 없음" 요청이 "state 일치" 로 읽혀 이 유닛이 무력화된다.
  assert.throws(() => decide(`${PATH}?code=x`, { expectedState: '' }), /GOOGLE_AUTH_STATE_REQUIRED/)
  assert.throws(() => decide(`${PATH}?code=x`, { expectedState: '   ' }), /GOOGLE_AUTH_STATE_REQUIRED/)
})

// ---- 자격증명이 실수로 커밋되는 경로에 쓰이지 않게 ----

const REPO = '/repo'

test('.env* 이름은 저장소 안이어도 안전하다 — .gitignore 가 이미 덮는다', () => {
  assert.equal(assertSecretOutPath({ outPath: '/repo/.env.drive-outbox', repoRoot: REPO }), '/repo/.env.drive-outbox')
  assert.equal(assertSecretOutPath({ outPath: '/repo/.env.local', repoRoot: REPO }), '/repo/.env.local')
})

test('저장소 밖은 주인이 고른 곳이라 그대로 둔다', () => {
  assert.equal(assertSecretOutPath({ outPath: '/home/me/secrets/tok.json', repoRoot: REPO }), '/home/me/secrets/tok.json')
})

test('저장소 안의 .env* 아닌 경로는 거부한다 — 그 파일은 커밋될 수 있다', () => {
  // 이 도구의 출력물 전체가 자격증명이다. 추적되는 경로에 쓰게 두면
  // 한 번의 git add -A 로 refresh token 이 공개 저장소에 올라간다.
  assert.throws(() => assertSecretOutPath({ outPath: '/repo/token.json', repoRoot: REPO }), /SECRET_OUT_PATH_TRACKABLE/)
  assert.throws(() => assertSecretOutPath({ outPath: '/repo/scripts/tok.env', repoRoot: REPO }), /SECRET_OUT_PATH_TRACKABLE/)
})

test('저장소 하위 디렉터리의 .env 는 최상위 .gitignore 규칙과 다르다 — 거부한다', () => {
  // .gitignore 의 `.env*` 는 최상위 패턴이 아니라 어디서나 매칭되지만,
  // 여기서 그 해석에 기대지 않는다. 확실한 것(최상위 .env*)만 허용한다.
  assert.throws(() => assertSecretOutPath({ outPath: '/repo/lib/.env.x', repoRoot: REPO }), /SECRET_OUT_PATH_TRACKABLE/)
})
