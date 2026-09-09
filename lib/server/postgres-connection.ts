/**
 * Unit 43 — Postgres 연결 문자열 해석과 sslmode 고정.
 *
 * 2026-09-09 프로덕션이 스스로 알려준 것에서 나왔다:
 *
 *   (node:4) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
 *   are treated as aliases for 'verify-full'.
 *   count=5 users=2 routes=/api/lifecycle/tasks, /api/lifecycle/candidates
 *
 * pg 8 은 세 모드를 `verify-full` 로 취급한다 — 서버 인증서를 실제로 검증한다.
 * pg 9 / pg-connection-string 3 부터 같은 문자열이 libpq 의미를 갖게 되어 검증이 사라진다.
 * 즉 의존성 한 번 올리면 코드 변경 0줄·에러 0건·테스트 전부 GREEN 인 채로
 * 가정 DB 로 가는 TLS 의 신원 확인만 조용히 없어진다.
 *
 * 여기서 하는 일은 오늘의 동작을 문자열에 명시적으로 적어두는 것뿐이다.
 * 지금 pg 가 하는 것과 같은 것을 요구하므로 프로덕션 동작은 바뀌지 않고,
 * 바뀌는 것은 그 의미가 라이브러리 버전에 더 이상 의존하지 않는다는 점이다.
 */

/** pg 가 오늘 `verify-full` 로 취급하고, pg 9 에서 뜻이 달라지는 세 모드. */
const AMBIGUOUS_SSL_MODE = /(^|&)(sslmode=)(prefer|require|verify-ca)(?=&|$)/gi

const PINNED_SSL_MODE = 'verify-full'

/** 경고문이 직접 제시하는 opt-in. 이걸 켠 사람은 libpq 의미를 고른 것이다. */
const LIBPQ_COMPAT = /(^|&)uselibpqcompat=/i

/**
 * 모호한 `sslmode` 만 `verify-full` 로 바꾸고 나머지는 한 바이트도 건드리지 않는다.
 *
 * URL 을 파싱해 다시 직렬화하지 않는 이유: 이 문자열에는 자격증명이 들어 있고,
 * 재직렬화는 퍼센트 인코딩을 조용히 정규화할 수 있다. 쿼리 구간에서 해당 값만 치환한다.
 *
 * 범위 한계(명시): libpq 키워드 형식(`host=... sslmode=require`)은 그대로 통과시킨다.
 * Neon·Vercel 이 내는 것은 URL 형식이고, 키워드 형식을 반쯤 이해한 척 고치는 것보다
 * 손대지 않는 편이 정직하다.
 */
export function pinPostgresSslMode(connectionString: string): string {
  const queryStart = connectionString.indexOf('?')
  // sslmode 를 적지 않은 문자열에 TLS 요구를 주입하지 않는다 —
  // 로컬 개발 DB 는 TLS 없이 돌고, 그것은 이 함수가 보존해야 할 동작이다.
  if (queryStart === -1) return connectionString

  const query = connectionString.slice(queryStart + 1)
  if (LIBPQ_COMPAT.test(query)) return connectionString

  const pinned = query.replace(AMBIGUOUS_SSL_MODE, (_match, separator, key) => `${separator}${key}${PINNED_SSL_MODE}`)
  if (pinned === query) return connectionString
  return `${connectionString.slice(0, queryStart + 1)}${pinned}`
}

/**
 * 세 호출부(lifecycle store · db:migrate · outbox:run)가 각자 쓰던 해석을 한 곳으로 모은다.
 * 고정을 여기서 함께 하므로 호출부가 그것을 잊을 수 없다.
 */
export function resolvePostgresConnectionString(env: {
  DATABASE_URL?: string
  POSTGRES_URL?: string
}): string | null {
  const raw = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim()
  if (!raw) return null
  return pinPostgresSslMode(raw)
}
