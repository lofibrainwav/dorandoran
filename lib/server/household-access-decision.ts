import type { HouseholdMember } from '../family-os/google-household-identity.ts'

export type HouseholdAccessDecision =
  | { kind: 'next' }
  | { kind: 'redirect'; to: '/signin' | '/family'; status: 307 }
  | { kind: 'unavailable' }

// The cron handler is public only in the proxy sense: the route itself requires CRON_SECRET.
// These API paths pass the browser gate because they perform their own stronger
// authorization: pairing claim uses a one-time code, and metadata ingest accepts
// either the web session or a registered device bearer token.
export const PUBLIC_ACCESS_PATHS: ReadonlySet<string> = new Set([
  '/signin',
  '/api/auth/google',
  '/api/cron/reconcile',
  '/api/photos/apple/devices/claim',
  '/api/photos/apple/metadata',
])

const HOME_PATH = '/'
const HOUSEHOLD_LANDING = '/family'

/**
 * Pure access gate for every non-public route. Google household identity is the only door:
 * incomplete configuration, unparsable or empty membership all fail closed as unavailable.
 */
export function decideHouseholdAccess(input: {
  pathname: string
  googleComplete: boolean
  membership: HouseholdMember[] | null
  sessionMember: HouseholdMember | null
}): HouseholdAccessDecision {
  if (PUBLIC_ACCESS_PATHS.has(input.pathname)) return { kind: 'next' }
  if (!input.googleComplete) return { kind: 'unavailable' }
  if (!input.membership || input.membership.length === 0) return { kind: 'unavailable' }
  if (input.sessionMember) {
    // `/` 는 고정 샘플 데모다. 홈을 공개하지 않기로 한 결재(2026-09-09) 이후 그 페이지는
    // 관객이 없다 — 로그인 안 한 사람은 닿지 못하고, 식구는 남의 가짜 일정을 볼 이유가 없다.
    // 주소창으로 들어와도 자기 주가 나와야 한다. `/` 에만 걸어야 한다: 경로를 가리지 않으면
    // /family 가 자기에게 무한히 리다이렉트한다.
    if (input.pathname === HOME_PATH) {
      return { kind: 'redirect', to: HOUSEHOLD_LANDING, status: 307 }
    }
    return { kind: 'next' }
  }
  return { kind: 'redirect', to: '/signin', status: 307 }
}
