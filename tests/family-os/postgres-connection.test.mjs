import test from 'node:test'
import assert from 'node:assert/strict'

import {
  pinPostgresSslMode,
  resolvePostgresConnectionString,
} from '../../lib/server/postgres-connection.ts'

// 2026-09-09 프로덕션 로그가 이 유닛을 부른 이유:
//   (node:4) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
//   are treated as aliases for 'verify-full'.
//   count=5 users=2 routes=/api/lifecycle/tasks, /api/lifecycle/candidates
// pg 8 은 세 모드를 verify-full 로 취급한다 — 인증서를 실제로 검증한다.
// pg 9 / pg-connection-string 3 부터 같은 문자열이 libpq 의미로 바뀌어 검증이 사라진다.
// 코드 변경 0줄·에러 0건·테스트 GREEN 인 채로 가정 DB 의 TLS 검증만 없어지는 것이 그 실패다.

// ---- pg 가 오늘 verify-full 로 취급하는 세 모드 ----

test('sslmode=require 는 verify-full 로 고정된다', () => {
  assert.equal(
    pinPostgresSslMode('postgres://u:p@host/db?sslmode=require'),
    'postgres://u:p@host/db?sslmode=verify-full',
  )
})

test('prefer 와 verify-ca 도 같이 고정된다 — 오늘 pg 는 셋을 같게 취급한다', () => {
  assert.equal(pinPostgresSslMode('postgres://h/db?sslmode=prefer'), 'postgres://h/db?sslmode=verify-full')
  assert.equal(pinPostgresSslMode('postgres://h/db?sslmode=verify-ca'), 'postgres://h/db?sslmode=verify-full')
})

test('값의 대소문자가 모호함을 숨기지 못한다', () => {
  assert.equal(pinPostgresSslMode('postgres://h/db?sslmode=REQUIRE'), 'postgres://h/db?sslmode=verify-full')
})

// ---- 바뀌면 안 되는 것 ----

test('sslmode 가 없으면 손대지 않는다', () => {
  // 로컬 개발 DB 는 TLS 없이 돈다. 여기서 verify-full 을 주입하면
  // "오늘의 동작을 보존한다" 는 이 함수의 전제를 스스로 깨뜨린다.
  assert.equal(pinPostgresSslMode('postgres://localhost:5432/dorandoran'), 'postgres://localhost:5432/dorandoran')
  assert.equal(
    pinPostgresSslMode('postgres://localhost:5432/dorandoran?application_name=x'),
    'postgres://localhost:5432/dorandoran?application_name=x',
  )
})

test('명시적으로 고른 모드는 모호함이 아니라 결정이다', () => {
  assert.equal(pinPostgresSslMode('postgres://h/db?sslmode=disable'), 'postgres://h/db?sslmode=disable')
  assert.equal(pinPostgresSslMode('postgres://h/db?sslmode=verify-full'), 'postgres://h/db?sslmode=verify-full')
})

test('uselibpqcompat 는 libpq 의미를 고른 사람의 결정이라 덮지 않는다', () => {
  // 경고문이 직접 제시하는 대안이다. 이걸 덮으면 우리가 사람의 선택을 뒤집는 것이 된다.
  const opted = 'postgres://h/db?uselibpqcompat=true&sslmode=require'
  assert.equal(pinPostgresSslMode(opted), opted)
})

test('sslmode 로 끝나기만 하는 다른 키는 건드리지 않는다', () => {
  const other = 'postgres://h/db?xsslmode=require'
  assert.equal(pinPostgresSslMode(other), other)
})

// ---- 자격증명은 한 바이트도 변하면 안 된다 ----

test('sslmode 값 말고는 바이트 단위로 동일하다', () => {
  assert.equal(
    pinPostgresSslMode(
      'postgresql://user:p%40ss%2Fword@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require&application_name=dorandoran',
    ),
    'postgresql://user:p%40ss%2Fword@ep-x.neon.tech/neondb?sslmode=verify-full&channel_binding=require&application_name=dorandoran',
  )
})

test('libpq 키워드 형식은 범위 밖이고 그대로 통과한다', () => {
  // Neon·Vercel 이 내는 것은 URL 형식이다. 키워드 형식을 반쯤 이해한 척 고치는 것보다
  // 손대지 않고 범위를 밝히는 편이 정직하다.
  const keywordValue = 'host=db.internal user=app sslmode=require'
  assert.equal(pinPostgresSslMode(keywordValue), keywordValue)
})

// ---- 세 호출부가 쓰는 해석기 ----

test('DATABASE_URL 이 우선이고 없으면 POSTGRES_URL 을 쓴다', () => {
  assert.equal(
    resolvePostgresConnectionString({ DATABASE_URL: 'postgres://a/db', POSTGRES_URL: 'postgres://b/db' }),
    'postgres://a/db',
  )
  assert.equal(resolvePostgresConnectionString({ POSTGRES_URL: 'postgres://b/db' }), 'postgres://b/db')
})

test('둘 다 없거나 공백뿐이면 null — 없음과 잘못됨을 섞지 않는다', () => {
  assert.equal(resolvePostgresConnectionString({}), null)
  assert.equal(resolvePostgresConnectionString({ DATABASE_URL: '   ' }), null)
  assert.equal(resolvePostgresConnectionString({ DATABASE_URL: '  ', POSTGRES_URL: 'postgres://b/db' }), 'postgres://b/db')
})

test('해석기는 고정까지 마친 문자열을 돌려준다 — 호출부가 잊을 수 없게', () => {
  assert.equal(
    resolvePostgresConnectionString({ DATABASE_URL: '  postgres://u:p@host/db?sslmode=require  ' }),
    'postgres://u:p@host/db?sslmode=verify-full',
  )
})
